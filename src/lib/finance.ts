import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureDefaultMoneyAccount } from "@/lib/ledger";
import { invoiceGrandTotal, invoicePaid } from "@/lib/invoices";
import { advanceBalance, billStatus } from "@/lib/finance-rules";

type Tx = Prisma.TransactionClient;

export const PAYMENT_METHODS = ["BANK_TRANSFER", "CASH", "MOBILE_MONEY", "CARD", "CHECK", "OTHER"] as const;
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: "Bank transfer",
  CASH: "Cash",
  MOBILE_MONEY: "Mobile money",
  CARD: "Card",
  CHECK: "Cheque",
  OTHER: "Other",
  ADVANCE: "Client advance / credit",
};
export const MONEY_ACCOUNT_KIND_LABELS: Record<string, string> = { CASH: "Cash", BANK: "Bank", MOBILE_MONEY: "Mobile money" };

/** Cash / bank / mobile money accounts to receive into or pay from (the cash box always exists). */
export async function activeMoneyAccounts() {
  const count = await prisma.moneyAccount.count({ where: { isDefault: true } });
  if (count === 0) await prisma.$transaction((tx) => ensureDefaultMoneyAccount(tx));
  return prisma.moneyAccount.findMany({
    where: { active: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: { id: true, name: true, kind: true, isDefault: true },
  });
}

const advanceInclude = {
  applications: { select: { amount: true } },
  refunds: { select: { amount: true } },
} satisfies Prisma.ClientAdvanceInclude;

export function balanceOfAdvance(a: { amount: unknown; applications: { amount: unknown }[]; refunds: { amount: unknown }[] }) {
  return advanceBalance(
    Number(a.amount),
    a.applications.map((p) => Number(p.amount)),
    a.refunds.map((r) => Number(r.amount)),
  );
}

export async function advanceRemaining(tx: Tx, advanceId: string) {
  const a = await tx.clientAdvance.findUniqueOrThrow({ where: { id: advanceId }, include: advanceInclude });
  return balanceOfAdvance(a);
}

/** A client's advances with credit left, oldest first (applied first-in, first-out). */
export async function clientCredits(db: Tx | typeof prisma, clientId: string) {
  const advances = await db.clientAdvance.findMany({
    where: { clientId },
    include: advanceInclude,
    orderBy: { receivedAt: "asc" },
  });
  return advances
    .map((a) => ({ id: a.id, advanceNumber: a.advanceNumber, receivedAt: a.receivedAt, source: a.source, ...balanceOfAdvance(a) }))
    .filter((a) => a.remaining > 0.005);
}

// Paid / partially paid follow from the payments; drafts and cancelled
// invoices keep their status.
export async function syncInvoiceStatus(tx: Tx, invoiceId: string) {
  const inv = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { items: true, payments: true } });
  if (inv.status === "CANCELLED") return inv.status;
  const paid = invoicePaid(inv.payments);
  const total = invoiceGrandTotal(inv);
  let next = inv.status;
  if (paid > 0.005) next = paid + 0.005 >= total ? "PAID" : "PARTIALLY_PAID";
  else if (inv.status === "PAID" || inv.status === "PARTIALLY_PAID") next = "SENT";
  if (next !== inv.status) await tx.invoice.update({ where: { id: invoiceId }, data: { status: next } });
  return next;
}

/** Bill total excludes rejected lines; status follows the payments. */
export async function billFigures(tx: Tx | typeof prisma, billId: string) {
  const bill = await tx.supplierBill.findUniqueOrThrow({
    where: { id: billId },
    include: { lines: { select: { amount: true, status: true } }, payments: { select: { amount: true } } },
  });
  const total = bill.lines.filter((l) => l.status !== "REJECTED").reduce((s, l) => s + Number(l.amount), 0);
  const paid = bill.payments.reduce((s, p) => s + Number(p.amount), 0);
  const awaitingApproval = bill.lines.filter((l) => l.status === "PENDING_APPROVAL").length;
  return { bill, total: Math.round(total * 100) / 100, paid: Math.round(paid * 100) / 100, balance: Math.round((total - paid) * 100) / 100, awaitingApproval };
}

export async function syncBillStatus(tx: Tx, billId: string) {
  const f = await billFigures(tx, billId);
  if (f.bill.status === "CANCELLED") return;
  const status = billStatus(f.total, f.paid);
  if (status !== f.bill.status) await tx.supplierBill.update({ where: { id: billId }, data: { status } });
  // Once the bill is settled, its lines are paid (the cash left through
  // the bill's supplier payments, so no separate per-expense payout entry).
  if (status === "PAID") {
    const now = new Date();
    await tx.expense.updateMany({
      where: { supplierBillId: billId, status: { in: ["PENDING", "APPROVED"] } },
      data: { status: "PAID", paidAt: now, payoutPostedAt: now },
    });
  }
}

/** Reads a yyyy-mm-dd query param as a local date (start of day), or the fallback. */
export function parseDay(value: string | string[] | undefined, fallback: Date): Date {
  const v = Array.isArray(value) ? value[0] : value;
  if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return fallback;
}

export function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
