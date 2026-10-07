"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/session";
import { checkPassword, RESET_RULES, rateLimit } from "@/lib/security-rules";
import { generateLinkToken } from "@/lib/totp";
import { findValidResetToken } from "@/lib/auth-tokens";
import { appBaseUrl, emailConfigured, sendEmail } from "@/lib/email";
import { clientIp, recordEvent } from "@/lib/login";
import { isFullAccessRole } from "@/lib/roles";

type State = { error: string | null; done?: boolean };

const RESET_LINK_MINUTES = 60;

/** Sets a new password and signs the user out of every session (the reason they're changing it may be a leak). */
async function setPassword(userId: string, password: string, extra: { emailVerified?: boolean } = {}) {
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      passwordChangedAt: new Date(),
      mustChangePassword: false,
      sessionVersion: { increment: 1 },
      ...(extra.emailVerified ? { emailVerifiedAt: new Date() } : {}),
    },
  });
  await prisma.rateLimitEvent.deleteMany({ where: { bucket: "login-fail", key: user.email } });
  return user;
}

// Signed-in user changing their own password (also the forced first-login change).
export async function changePasswordAction(_prev: State, formData: FormData): Promise<State> {
  const me = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await bcrypt.compare(current, user.passwordHash))) return { error: "Your current password is not correct." };
  if (next !== confirm) return { error: "The new passwords don't match." };
  if (next === current) return { error: "Choose a password you haven't used here before." };
  const problem = checkPassword(next, { email: user.email, name: user.name });
  if (problem) return { error: problem };
  await setPassword(user.id, next);
  await audit(prisma, me, { action: "PASSWORD_CHANGED", module: "Security", entityType: "User", entityId: me.id, message: `${me.name} changed their password.` });
  redirect("/login?reset=1");
}

// "Forgot password": the same answer whether or not the account exists, so
// the form can't be used to find out who has an account.
export async function requestPasswordResetAction(_prev: State, formData: FormData): Promise<State> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter your email address." };
  const ip = clientIp(await headers());

  const since = new Date(Date.now() - RESET_RULES.perAccount.windowMs);
  const [acct, net] = await Promise.all([
    prisma.rateLimitEvent.findMany({ where: { bucket: "reset", key: email, createdAt: { gt: since } }, select: { createdAt: true } }),
    prisma.rateLimitEvent.findMany({ where: { bucket: "reset-ip", key: ip, createdAt: { gt: since } }, select: { createdAt: true } }),
  ]);
  const limited =
    !rateLimit(acct.map((x) => x.createdAt), RESET_RULES.perAccount).allowed || !rateLimit(net.map((x) => x.createdAt), RESET_RULES.perIp).allowed;
  if (limited) return { error: null, done: true };
  await recordEvent("reset", email);
  await recordEvent("reset-ip", ip);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) return { error: null, done: true };

  if (emailConfigured()) {
    const { token, hash } = generateLinkToken();
    await prisma.authToken.create({
      data: { purpose: "PASSWORD_RESET", tokenHash: hash, userId: user.id, expiresAt: new Date(Date.now() + RESET_LINK_MINUTES * 60_000) },
    });
    const link = `${await appBaseUrl()}/reset-password?token=${token}`;
    await sendEmail(
      user.email,
      "Reset your Portsimex Services password",
      `Hello ${user.name},\n\nSomeone (hopefully you) asked to reset the password for your Portsimex Services account.\n\nReset it here (the link works once and expires in ${RESET_LINK_MINUTES} minutes):\n${link}\n\nIf you didn't ask for this, ignore this email -- your password stays the same.\n`,
    );
  } else {
    // No email service: let the administrators know so they can send the
    // user a reset link from the Users page.
    const admins = await prisma.user.findMany({ where: { active: true, role: { in: ["ADMIN", "SUPERVISOR"] } }, select: { id: true } });
    if (admins.length) {
      await prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          type: "SECURITY_ALERT" as const,
          message: `${user.name} (${user.email}) asked to reset their password. Open Users → ${user.name} → "Create password reset link" and send it to them.`,
        })),
      });
    }
  }
  await audit(prisma, null, { action: "PASSWORD_RESET_REQUESTED", module: "Security", entityType: "User", entityId: user.id, message: `Password reset requested for ${user.email}.` });
  return { error: null, done: true };
}

export async function resetPasswordAction(token: string, _prev: State, formData: FormData): Promise<State> {
  const row = await findValidResetToken(token);
  if (!row) return { error: "This link has expired or was already used. Ask for a new one." };
  const next = String(formData.get("password") ?? "");
  if (next !== String(formData.get("confirm") ?? "")) return { error: "The passwords don't match." };
  const problem = checkPassword(next, { email: row.user.email, name: row.user.name });
  if (problem) return { error: problem };
  // A link that went to the user's inbox proves they own the address.
  await setPassword(row.userId, next, { emailVerified: !row.createdById });
  await prisma.authToken.updateMany({ where: { userId: row.userId, purpose: "PASSWORD_RESET", usedAt: null }, data: { usedAt: new Date() } });
  await audit(prisma, row.user, { action: "PASSWORD_RESET", module: "Security", entityType: "User", entityId: row.userId, message: `${row.user.name} set a new password using a reset link.` });
  redirect("/login?reset=1");
}

// ---------------------------------------------------------------------------
// Administrator actions on another user's account
// ---------------------------------------------------------------------------

/** An administrator acting on another account; only Super Admins may act on Super Admin accounts. */
async function requireUserAdmin(targetId: string) {
  const me = await requireUser();
  if (!isFullAccessRole(me.role) && !me.grant.permissions.includes("users.manage")) redirect("/no-access?need=users.manage");
  const target = await prisma.user.findUniqueOrThrow({ where: { id: targetId } });
  if (isFullAccessRole(target.role) && !isFullAccessRole(me.role)) redirect("/no-access?need=admin");
  return { me, target };
}

/** A one-time reset link for the admin to send the user (WhatsApp, SMS...). Valid 24 hours. */
export async function createResetLinkAction(userId: string, _prev: { error: string | null; link?: string }): Promise<{ error: string | null; link?: string }> {
  const { me, target: user } = await requireUserAdmin(userId);
  if (!user.active) return { error: "Reactivate the account first." };
  const { token, hash } = generateLinkToken();
  await prisma.authToken.create({
    data: { purpose: "PASSWORD_RESET", tokenHash: hash, userId, createdById: me.id, expiresAt: new Date(Date.now() + 24 * 3_600_000) },
  });
  await audit(prisma, me, { action: "RESET_LINK_CREATED", module: "Security", entityType: "User", entityId: userId, message: `${me.name} created a password reset link for ${user.name}.` });
  return { error: null, link: `${await appBaseUrl()}/reset-password?token=${token}` };
}

export async function signOutUserEverywhereAction(userId: string, _prev: State): Promise<State> {
  const { me } = await requireUserAdmin(userId);
  const user = await prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
  await audit(prisma, me, { action: "SESSIONS_REVOKED", module: "Security", entityType: "User", entityId: userId, message: `${me.name} signed ${user.name} out of all devices.` });
  if (userId === me.id) redirect("/login?ended=1");
  return { error: null, done: true };
}

/** For a user who lost their phone and their recovery codes. */
export async function resetUserMfaAction(userId: string, _prev: State): Promise<State> {
  const { me } = await requireUserAdmin(userId);
  const user = await prisma.user.update({
    where: { id: userId },
    data: { mfaSecret: null, mfaPendingSecret: null, mfaEnabledAt: null, mfaRecoveryCodes: [], sessionVersion: { increment: 1 } },
  });
  await audit(prisma, me, { action: "MFA_RESET", module: "Security", entityType: "User", entityId: userId, message: `${me.name} turned off two-factor login for ${user.name} (lost device).` });
  return { error: null, done: true };
}

export async function sendVerificationEmailAction(_prev: State): Promise<State> {
  const me = await requireUser();
  if (!emailConfigured()) return { error: "Email isn't set up on this system yet -- ask your administrator." };
  const { token, hash } = generateLinkToken();
  await prisma.authToken.create({ data: { purpose: "VERIFY_EMAIL", tokenHash: hash, userId: me.id, expiresAt: new Date(Date.now() + 48 * 3_600_000) } });
  const ok = await sendEmail(me.email, "Confirm your email address", `Hello ${me.name},\n\nConfirm this is your email address for Portsimex Services:\n${await appBaseUrl()}/verify-email?token=${token}\n\nThe link expires in 48 hours.\n`);
  return ok ? { error: null, done: true } : { error: "The email could not be sent. Try again later." };
}
