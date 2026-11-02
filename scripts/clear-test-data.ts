// Clears all test data before going live -- the same wipe as the
// "Clear test data" button in Settings, run from a terminal:
//
//   npx tsx scripts/clear-test-data.ts            (asks you to type CLEAR)
//
// Uses DATABASE_URL from .env. Keeps users, roles, settings, the service
// catalog, ministries, chart of accounts, expense categories and bank/cash
// accounts. Deletes all work, money, clients, vendors, agencies and history.
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { wipeTestData } from "../src/lib/test-data";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing. Get it with:  npx vercel env pull .env --environment=production");
  process.exit(1);
}

let host = "(unknown)";
try {
  const u = new URL(url);
  host = `${u.hostname}${u.pathname}`;
} catch {}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const [clients, requests, jobs, invoices, payments, expenses] = await Promise.all([
    prisma.client.count(),
    prisma.serviceRequest.count(),
    prisma.job.count(),
    prisma.invoice.count(),
    prisma.payment.count(),
    prisma.expense.count(),
  ]);
  console.log(`\nDatabase: ${host}`);
  console.log(`Will delete: ${clients} clients, ${requests} requests, ${jobs} jobs, ${invoices} invoices, ${payments} payments, ${expenses} expenses`);
  console.log("plus vendors, agencies, shipments, purchases, ledger, notifications and the audit trail.");
  console.log("Kept: users, roles, settings, service catalog, ministries, chart of accounts, bank/cash accounts.\n");

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question('Type CLEAR to delete everything above (anything else cancels): ')).trim();
  rl.close();
  if (answer !== "CLEAR") {
    console.log("Cancelled -- nothing was deleted.");
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      await wipeTestData(tx);
      await tx.auditLog.create({
        data: {
          action: "TEST_DATA_CLEARED",
          module: "Security",
          entityType: "AppSettings",
          entityId: "default",
          actorName: "Clear-test-data script",
          message: "All test data (work, money, clients, vendors, agencies and history) was cleared from the command line before going live.",
        },
      });
    },
    { timeout: 120_000 },
  );
  console.log("Done -- all test data cleared. Numbering restarts at 1 (e.g. SR-2026-00001).");
}

main()
  .catch((e) => {
    console.error("Failed -- nothing was deleted:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
