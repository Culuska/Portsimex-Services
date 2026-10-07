// Money rules for Phase 3: payment splitting, advance balances, supplier
// bill status, aging, statements and manual journals.
// Pure module (no app imports) so every rule is unit tested.

const round = (n: number) => Math.round(n * 100) / 100 || 0;
const EPS = 0.005;

export class FinanceRuleError extends Error {}

/**
 * A client payment against an invoice: the part that settles the balance,
 * and any excess, which is kept as client credit (an advance) rather than
 * pushing the invoice below zero.
 */
export function splitPayment(amount: number, invoiceBalance: number): { applied: number; excess: number } {
  const applied = round(Math.min(amount, Math.max(invoiceBalance, 0)));
  return { applied, excess: round(amount - applied) };
}

export type AdvanceBalance = { amount: number; applied: number; refunded: number; remaining: number };

export function advanceBalance(amount: number, applications: number[], refunds: number[]): AdvanceBalance {
  const applied = round(applications.reduce((s, a) => s + a, 0));
  const refunded = round(refunds.reduce((s, a) => s + a, 0));
  return { amount: round(amount), applied, refunded, remaining: round(amount - applied - refunded) };
}

/** Applying credit to an invoice: never more than the credit left or the invoice balance. */
export function checkAdvanceApplication(amount: number, remaining: number, invoiceBalance: number): string | null {
  if (!(amount > 0)) return "Enter an amount greater than zero.";
  if (amount > remaining + EPS) return `Only ${remaining.toFixed(2)} of this advance is left.`;
  if (amount > invoiceBalance + EPS) return `The invoice balance is only ${Math.max(invoiceBalance, 0).toFixed(2)}.`;
  return null;
}

export function checkRefund(amount: number, remaining: number): string | null {
  if (!(amount > 0)) return "Enter an amount greater than zero.";
  if (amount > remaining + EPS) return `Only ${remaining.toFixed(2)} of this advance is unused and can be refunded.`;
  return null;
}

export type BillStatus = "OPEN" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";

export function billStatus(total: number, paid: number, cancelled = false): BillStatus {
  if (cancelled) return "CANCELLED";
  if (paid <= EPS) return "OPEN";
  return paid + EPS >= total ? "PAID" : "PARTIALLY_PAID";
}

export function checkSupplierPayment(amount: number, balance: number, linesAwaitingApproval: number): string | null {
  if (!(amount > 0)) return "Enter an amount greater than zero.";
  if (linesAwaitingApproval > 0) return `${linesAwaitingApproval} line(s) on this bill still need manager approval before it can be paid.`;
  if (amount > balance + EPS) return `The bill balance is only ${Math.max(balance, 0).toFixed(2)}.`;
  return null;
}

// ---------------------------------------------------------------------------
// Aging (receivables and payables)
// ---------------------------------------------------------------------------

export const AGING_BUCKETS = ["CURRENT", "1-30", "31-60", "61-90", "90+"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];
export const AGING_LABELS: Record<AgingBucket, string> = {
  CURRENT: "Not yet due",
  "1-30": "1-30 days",
  "31-60": "31-60 days",
  "61-90": "61-90 days",
  "90+": "Over 90 days",
};

function dayNumber(d: Date) {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

export function daysPastDue(dueDate: Date, now = new Date()): number {
  return dayNumber(now) - dayNumber(dueDate);
}

export function agingBucket(dueDate: Date, now = new Date()): AgingBucket {
  const days = daysPastDue(dueDate, now);
  if (days <= 0) return "CURRENT";
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export type AgingItem = { key: string; label: string; dueDate: Date; balance: number };
export type AgingRow = { key: string; label: string; buckets: Record<AgingBucket, number>; total: number; count: number };

function emptyBuckets(): Record<AgingBucket, number> {
  return { CURRENT: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
}

/** Groups open items (invoices, bills) per client / supplier into aging buckets. */
export function ageItems(items: AgingItem[], now = new Date()): { rows: AgingRow[]; totals: Record<AgingBucket, number>; total: number } {
  const byKey = new Map<string, AgingRow>();
  const totals = emptyBuckets();
  for (const item of items) {
    if (item.balance <= EPS) continue;
    const row = byKey.get(item.key) ?? { key: item.key, label: item.label, buckets: emptyBuckets(), total: 0, count: 0 };
    const bucket = agingBucket(item.dueDate, now);
    row.buckets[bucket] = round(row.buckets[bucket] + item.balance);
    row.total = round(row.total + item.balance);
    row.count += 1;
    totals[bucket] = round(totals[bucket] + item.balance);
    byKey.set(item.key, row);
  }
  const rows = [...byKey.values()].sort((a, b) => b.total - a.total);
  return { rows, totals, total: round(rows.reduce((s, r) => s + r.total, 0)) };
}

// ---------------------------------------------------------------------------
// Client statement of account
// ---------------------------------------------------------------------------

export type StatementEntry = {
  date: Date;
  type: string;
  reference: string;
  description: string;
  /** Increases what the client owes (invoice, refund paid out). */
  debit: number;
  /** Decreases it (payment, advance received, cancellation). */
  credit: number;
};

export type Statement = {
  opening: number;
  rows: (StatementEntry & { balance: number })[];
  totalDebit: number;
  totalCredit: number;
  closing: number;
};

/** Opening balance from everything before `from`, then each entry in the period with a running balance. */
export function buildStatement(entries: StatementEntry[], from: Date, to: Date): Statement {
  // In time order; a charge and a payment at the same moment list the charge first.
  const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime() || (a.debit > 0 ? 0 : 1) - (b.debit > 0 ? 0 : 1));
  let opening = 0;
  const inPeriod: StatementEntry[] = [];
  for (const e of sorted) {
    if (e.date < from) opening += e.debit - e.credit;
    else if (e.date <= to) inPeriod.push(e);
  }
  let balance = round(opening);
  const rows = inPeriod.map((e) => {
    balance = round(balance + e.debit - e.credit);
    return { ...e, balance };
  });
  const totalDebit = round(inPeriod.reduce((s, e) => s + e.debit, 0));
  const totalCredit = round(inPeriod.reduce((s, e) => s + e.credit, 0));
  return { opening: round(opening), rows, totalDebit, totalCredit, closing: balance };
}

// ---------------------------------------------------------------------------
// Manual journal entries
// ---------------------------------------------------------------------------

export type JournalLineInput = { accountId: string; debit: number; credit: number };

export function checkJournal(lines: JournalLineInput[]): string | null {
  const used = lines.filter((l) => l.accountId && (l.debit > 0 || l.credit > 0));
  if (used.length < 2) return "A journal entry needs at least two lines.";
  for (const l of used) {
    if (l.debit < 0 || l.credit < 0) return "Amounts can't be negative.";
    if (l.debit > 0 && l.credit > 0) return "Each line is either a debit or a credit, not both.";
  }
  const debits = round(used.reduce((s, l) => s + l.debit, 0));
  const credits = round(used.reduce((s, l) => s + l.credit, 0));
  if (Math.abs(debits - credits) > EPS) return `Debits (${debits.toFixed(2)}) must equal credits (${credits.toFixed(2)}).`;
  return null;
}

// ---------------------------------------------------------------------------
// Money account codes
// ---------------------------------------------------------------------------

/** Next free 10xx asset code for a new cash / bank / mobile money account (1000 is the cash box). */
export function nextMoneyAccountCode(existingCodes: string[]): string {
  const used = new Set(existingCodes);
  for (let n = 1010; n < 1100; n += 10) {
    if (!used.has(String(n))) return String(n);
  }
  for (let n = 1001; n < 1100; n++) {
    if (!used.has(String(n))) return String(n);
  }
  throw new FinanceRuleError("No free cash/bank account codes left (1001-1099).");
}

/**
 * The moment to record for a date picked on a form (yyyy-mm-dd): today's
 * date means "now" -- so same-day events keep the order they happened in --
 * while a back-dated entry is recorded at the start of that day.
 */
export function businessDate(value: string, now = new Date()): Date {
  return value === now.toISOString().slice(0, 10) ? now : new Date(value);
}

/** Payments / refunds above the authorization threshold need someone holding payments.authorize. */
export function checkPaymentAuthorization(amount: number, threshold: number, canAuthorize: boolean): string | null {
  if (canAuthorize || amount <= threshold + EPS) return null;
  return `Payments over ${threshold.toFixed(2)} must be made by someone who can authorize payments (e.g. the Finance Manager).`;
}
