"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireAdmin, requirePermission } from "@/lib/session";
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

// ---------------------------------------------------------------------------
// Clearing test data (Super Admin only, before going live)
// ---------------------------------------------------------------------------

// Work, money and history -- plus clients, vendors and agencies. Kept:
// users, roles, settings, service catalog, ministries, chart of accounts,
// expense categories and bank / cash accounts (their balances restart at 0).
const TEST_DATA_TABLES = [
  "client_service_rates",
  "client_notes",
  "client_follow_ups",
  "service_request_lines",
  "service_requests",
  "job_follow_ups",
  "job_submissions",
  "job_documents",
  "job_tasks",
  "job_stages",
  "jobs",
  "quote_items",
  "quotes",
  "invoice_items",
  "payments",
  "invoices",
  "advance_refunds",
  "client_advances",
  "supplier_payments",
  "supplier_bills",
  "expenses",
  "purchase_requests",
  "money_transfers",
  "ledger_lines",
  "ledger_transactions",
  "approval_actions",
  "approval_steps",
  "clearance_document_versions",
  "clearance_documents",
  "delivery_records",
  "shipments",
  "vendors",
  "government_agencies",
  "notifications",
  "audit_logs",
  "document_counters",
  "rate_limit_events",
];
const SEQUENCES = ["invoice_number_seq", "quote_number_seq", "purchase_request_number_seq", "shipment_reference_seq"];

export async function clearTestDataAction(_prev: { error: string | null; done?: boolean }, formData: FormData): Promise<{ error: string | null; done?: boolean }> {
  const me = await requireAdmin();
  if (String(formData.get("confirm") ?? "").trim() !== "CLEAR") return { error: 'Type CLEAR (in capitals) to confirm.' };
  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await bcrypt.compare(String(formData.get("password") ?? ""), user.passwordHash))) return { error: "Your password is not correct." };

  await prisma.$transaction(
    async (tx) => {
      // Vendor-portal accounts point at a client: unlink them (and switch them
      // off -- they have no company left to see) before clients go.
      await tx.user.updateMany({ where: { role: "VENDOR" }, data: { active: false, sessionVersion: { increment: 1 } } });
      await tx.user.updateMany({ where: { vendorClientId: { not: null } }, data: { vendorClientId: null } });
      // TRUNCATE bypasses the row triggers that keep the ledger and audit
      // trail append-only -- this is the one deliberate exception.
      await tx.$executeRawUnsafe(`TRUNCATE ${TEST_DATA_TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY`);
      await tx.$executeRawUnsafe(`DELETE FROM "clients"`);
      for (const seq of SEQUENCES) await tx.$executeRawUnsafe(`ALTER SEQUENCE "${seq}" RESTART WITH 1`);
      await audit(tx, me, {
        action: "TEST_DATA_CLEARED",
        module: "Security",
        entityType: "AppSettings",
        entityId: "default",
        message: `${me.name} cleared all test data (work, money, clients, vendors, agencies and history) before going live.`,
      });
    },
    { timeout: 60_000 },
  );
  revalidatePath("/", "layout");
  return { error: null, done: true };
}
