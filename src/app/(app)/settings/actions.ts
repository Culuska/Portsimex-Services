"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { audit } from "@/lib/audit";

const schema = z.object({
  expenseApprovalThreshold: z.coerce.number().min(0, "The approval threshold can't be negative"),
  paymentAuthorizationThreshold: z.coerce.number().min(0, "The authorization threshold can't be negative"),
  sessionHours: z.coerce.number().int().min(1, "Sessions last at least 1 hour").max(720, "Sessions last at most 30 days (720 hours)"),
});

export async function saveSettingsAction(_prev: { error: string | null }, formData: FormData): Promise<{ error: string | null }> {
  const me = await requirePermission("settings.manage");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = { ...parsed.data, requireMfaForManagers: formData.get("requireMfaForManagers") === "on" };
  if (data.requireMfaForManagers && !me.mfaEnabled) {
    return { error: "Turn on two-factor login for your own account first (My account), so you don't lock yourself out of these settings." };
  }
  await prisma.$transaction(async (tx) => {
    const before = await tx.appSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
    await tx.appSettings.update({ where: { id: "default" }, data });
    await audit(tx, me, {
      action: "SETTINGS_UPDATED",
      module: "Security",
      entityType: "AppSettings",
      entityId: "default",
      message: `${me.name} changed the approval and security settings.`,
      before: {
        expenseApprovalThreshold: before.expenseApprovalThreshold.toString(),
        paymentAuthorizationThreshold: before.paymentAuthorizationThreshold.toString(),
        sessionHours: before.sessionHours,
        requireMfaForManagers: before.requireMfaForManagers,
      },
      after: { ...data, expenseApprovalThreshold: String(data.expenseApprovalThreshold), paymentAuthorizationThreshold: String(data.paymentAuthorizationThreshold) },
    });
  });
  revalidatePath("/settings");
  return { error: null };
}
