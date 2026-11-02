import type { Prisma } from "../generated/prisma/client";

// Clearing test data before going live. Used by the button in Settings and by
// scripts/clear-test-data.ts (run from PowerShell) so both wipe exactly the same.
//
// Wiped: work, money and history -- plus clients, vendors and agencies.
// Kept: users, roles, settings, service catalog, ministries, chart of
// accounts, expense categories and bank / cash accounts (balances restart at 0).
export const TEST_DATA_TABLES = [
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
export const TEST_DATA_SEQUENCES = ["invoice_number_seq", "quote_number_seq", "purchase_request_number_seq", "shipment_reference_seq"];

/** Wipes all test data. Run inside a transaction; write the audit entry after. */
export async function wipeTestData(tx: Prisma.TransactionClient) {
  // Vendor-portal accounts point at a client: unlink them (and switch them
  // off -- they have no company left to see) before clients go.
  await tx.user.updateMany({ where: { role: "VENDOR" }, data: { active: false, sessionVersion: { increment: 1 } } });
  await tx.user.updateMany({ where: { vendorClientId: { not: null } }, data: { vendorClientId: null } });
  // TRUNCATE bypasses the row triggers that keep the ledger and audit
  // trail append-only -- this is the one deliberate exception.
  await tx.$executeRawUnsafe(`TRUNCATE ${TEST_DATA_TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY`);
  await tx.$executeRawUnsafe(`DELETE FROM "clients"`);
  for (const seq of TEST_DATA_SEQUENCES) await tx.$executeRawUnsafe(`ALTER SEQUENCE "${seq}" RESTART WITH 1`);
}
