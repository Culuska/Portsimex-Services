"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/session";
import { mfaKey } from "@/lib/login";
import { decryptSecret, encryptSecret, generateRecoveryCodes, generateTotpSecret, verifyTotp } from "@/lib/totp";

type CodesState = { error: string | null; codes?: string[] };

/** Step 1: a new secret, kept pending until the user proves their app works. */
export async function startMfaSetupAction() {
  const me = await requireUser();
  await prisma.user.update({ where: { id: me.id }, data: { mfaPendingSecret: encryptSecret(generateTotpSecret(), mfaKey()) } });
  revalidatePath("/account");
}

export async function cancelMfaSetupAction() {
  const me = await requireUser();
  await prisma.user.update({ where: { id: me.id }, data: { mfaPendingSecret: null } });
  revalidatePath("/account");
}

/** Step 2: the first code from the app turns two-factor on and returns recovery codes (shown once). */
export async function confirmMfaAction(_prev: CodesState, formData: FormData): Promise<CodesState> {
  const me = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!user.mfaPendingSecret) return { error: "Start the setup again." };
  const secret = decryptSecret(user.mfaPendingSecret, mfaKey());
  if (!verifyTotp(secret, String(formData.get("code") ?? ""))) {
    return { error: "That code didn't match. Check the time on your phone is set automatically, then enter the current code." };
  }
  const { codes, hashes } = generateRecoveryCodes();
  await prisma.user.update({
    where: { id: me.id },
    data: { mfaSecret: user.mfaPendingSecret, mfaPendingSecret: null, mfaEnabledAt: new Date(), mfaRecoveryCodes: hashes },
  });
  await audit(prisma, me, { action: "MFA_ENABLED", module: "Security", entityType: "User", entityId: me.id, message: `${me.name} turned on two-factor login.` });
  return { error: null, codes };
}

async function checkCode(userId: string, code: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.mfaSecret) return false;
  return verifyTotp(decryptSecret(user.mfaSecret, mfaKey()), code);
}

export async function regenerateRecoveryCodesAction(_prev: CodesState, formData: FormData): Promise<CodesState> {
  const me = await requireUser();
  if (!(await checkCode(me.id, String(formData.get("code") ?? "")))) return { error: "Enter the current code from your authenticator app." };
  const { codes, hashes } = generateRecoveryCodes();
  await prisma.user.update({ where: { id: me.id }, data: { mfaRecoveryCodes: hashes } });
  await audit(prisma, me, { action: "MFA_RECOVERY_CODES_RENEWED", module: "Security", entityType: "User", entityId: me.id, message: `${me.name} created new recovery codes.` });
  return { error: null, codes };
}

export async function disableMfaAction(_prev: { error: string | null }, formData: FormData): Promise<{ error: string | null }> {
  const me = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await bcrypt.compare(String(formData.get("password") ?? ""), user.passwordHash))) return { error: "Your password is not correct." };
  if (!(await checkCode(me.id, String(formData.get("code") ?? "")))) return { error: "Enter the current code from your authenticator app." };
  await prisma.user.update({ where: { id: me.id }, data: { mfaSecret: null, mfaEnabledAt: null, mfaRecoveryCodes: [] } });
  await audit(prisma, me, { action: "MFA_DISABLED", module: "Security", entityType: "User", entityId: me.id, message: `${me.name} turned off two-factor login.` });
  revalidatePath("/account");
  return { error: null };
}

export async function signOutEverywhereAction() {
  const me = await requireUser();
  await prisma.user.update({ where: { id: me.id }, data: { sessionVersion: { increment: 1 } } });
  await audit(prisma, me, { action: "SESSIONS_REVOKED", module: "Security", entityType: "User", entityId: me.id, message: `${me.name} signed out of all devices.` });
  redirect("/login?ended=1");
}
