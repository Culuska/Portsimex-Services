import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  formatJobNumber,
  formatServiceRequestNumber,
  jobCounterKey,
  serviceRequestCounterKey,
} from "@/lib/document-numbers";

type Db = Prisma.TransactionClient | typeof prisma;

// INSERT ... ON CONFLICT DO UPDATE ... RETURNING is a single atomic
// statement, so concurrent creates can never receive the same number --
// the same guarantee as the Postgres sequences used for invoices/quotes,
// but for keys only known at runtime (one counter per job prefix per year).
async function nextCounter(db: Db, key: string): Promise<number> {
  const rows = await db.$queryRaw<{ value: bigint }[]>`
    INSERT INTO "document_counters" ("key", "value") VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET "value" = "document_counters"."value" + 1
    RETURNING "value"
  `;
  return Number(rows[0].value);
}

export async function nextJobNumber(db: Db, prefix: string, year = new Date().getFullYear()) {
  return formatJobNumber(prefix, year, await nextCounter(db, jobCounterKey(prefix, year)));
}

export async function nextServiceRequestNumber(db: Db, year = new Date().getFullYear()) {
  return formatServiceRequestNumber(year, await nextCounter(db, serviceRequestCounterKey(year)));
}

// nextval() on a Postgres sequence is atomic, so concurrent invoice
// creation can never collide on the same number.
export async function nextInvoiceNumber(db: Db, year = new Date().getFullYear()) {
  const [{ nextval }] = await db.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('invoice_number_seq') AS nextval`;
  return `INV-${year}-${String(nextval).padStart(4, "0")}`;
}

// Yearly numbered finance documents: ADV-2026-00001 (client advances),
// BILL-2026-00001 (supplier bills), EXP-2026-00001 (expenses).
export async function nextFinanceNumber(db: Db, prefix: "ADV" | "BILL" | "EXP", year = new Date().getFullYear()) {
  const seq = await nextCounter(db, `${prefix}-${year}`);
  return `${prefix}-${year}-${String(seq).padStart(5, "0")}`;
}
