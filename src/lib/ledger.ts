import type { Prisma } from "@/generated/prisma/client";
import { invoiceTotals } from "@/lib/invoices";
import { nextMoneyAccountCode } from "@/lib/finance-rules";

type TxClient = Prisma.TransactionClient;
type LedgerSourceType =
  | "INVOICE_REVENUE"
  | "INVOICE_PAYMENT"
  | "EXPENSE_ACCRUAL"
  | "EXPENSE_PAYOUT"
  | "MANUAL"
  | "INVOICE_REVERSAL"
  | "EXPENSE_REVERSAL"
  | "ADVANCE_RECEIPT"
  | "ADVANCE_REFUND"
  | "SUPPLIER_PAYMENT"
  | "TRANSFER";
type LedgerDirection = "DEBIT" | "CREDIT";
type PostingLine = { accountId: string; direction: LedgerDirection; amount: number };

export class UnbalancedLedgerEntryError extends Error {}

const SYSTEM_ACCOUNTS = {
  CASH: { code: "1000", name: "Cash", type: "ASSET" as const },
  ACCOUNTS_RECEIVABLE: { code: "1100", name: "Accounts Receivable", type: "ASSET" as const },
  // Costs paid on a client's behalf that will be re-charged to them (e.g. a
  // government fee): an amount the client owes back, not a company expense.
  CLIENT_DISBURSEMENTS: { code: "1200", name: "Client Disbursements Recoverable", type: "ASSET" as const },
  ACCOUNTS_PAYABLE: { code: "2000", name: "Accounts Payable", type: "LIABILITY" as const },
  // Money clients paid before being invoiced: owed back as services or a
  // refund, so a liability until applied to an invoice -- never revenue.
  CLIENT_ADVANCES: { code: "2100", name: "Client Advances & Credits", type: "LIABILITY" as const },
  TAX_PAYABLE: { code: "2200", name: "Tax Payable", type: "LIABILITY" as const },
  OWNER_EQUITY: { code: "3000", name: "Owner's Equity", type: "EQUITY" as const },
  FREIGHT_REVENUE: { code: "4000", name: "Service Revenue", type: "REVENUE" as const },
};

export async function ensureSystemAccount(tx: TxClient, key: keyof typeof SYSTEM_ACCOUNTS) {
  const spec = SYSTEM_ACCOUNTS[key];
  return tx.account.upsert({
    where: { code: spec.code },
    update: {},
    create: { code: spec.code, name: spec.name, type: spec.type, isSystem: true },
  });
}

// One EXPENSE account per ExpenseCategory, created the first time a
// category is accrued so categorized costs (fuel, carrier fees, customs
// duties, ...) each post to their own ledger account.
async function ensureExpenseCategoryAccount(tx: TxClient, categoryId: string, categoryName: string) {
  const category = await tx.expenseCategory.findUniqueOrThrow({ where: { id: categoryId } });
  if (category.accountId) {
    return tx.account.findUniqueOrThrow({ where: { id: category.accountId } });
  }
  const account = await tx.account.create({
    data: { code: `5-${categoryId}`, name: `${categoryName} Expense`, type: "EXPENSE" },
  });
  await tx.expenseCategory.update({ where: { id: categoryId }, data: { accountId: account.id } });
  return account;
}

// Every ledger posting goes through here so a debit can never be written
// without its matching credit -- the one place double-entry balance is
// actually enforced, rather than trusting each call site to get it right.
async function postTransaction(
  tx: TxClient,
  params: {
    memo: string;
    sourceType: LedgerSourceType;
    createdById?: string | null;
    invoiceId?: string;
    paymentId?: string;
    expenseId?: string;
    advanceId?: string;
    refundId?: string;
    supplierPaymentId?: string;
    transferId?: string;
    /** Business date of the event (payment date, bill date...); defaults to now. */
    date?: Date;
    lines: PostingLine[];
  },
) {
  const round = (n: number) => Math.round(n * 100);
  const debits = params.lines.filter((l) => l.direction === "DEBIT").reduce((s, l) => s + round(l.amount), 0);
  const credits = params.lines.filter((l) => l.direction === "CREDIT").reduce((s, l) => s + round(l.amount), 0);
  if (debits !== credits) {
    throw new UnbalancedLedgerEntryError(
      `Unbalanced ledger entry "${params.memo}": debits ${debits / 100} != credits ${credits / 100}`,
    );
  }

  return tx.ledgerTransaction.create({
    data: {
      memo: params.memo,
      sourceType: params.sourceType,
      createdById: params.createdById ?? null,
      invoiceId: params.invoiceId,
      paymentId: params.paymentId,
      expenseId: params.expenseId,
      advanceId: params.advanceId,
      refundId: params.refundId,
      supplierPaymentId: params.supplierPaymentId,
      transferId: params.transferId,
      ...(params.date ? { transactionDate: params.date } : {}),
      lines: {
        create: params.lines.filter((l) => Math.round(l.amount * 100) !== 0).map((l) => ({
          accountId: l.accountId,
          direction: l.direction,
          amount: l.amount,
        })),
      },
    },
  });
}

// Invoice Paid workflow, step 1: recognize revenue when the invoice is
// issued. Idempotent -- guarded by Invoice.revenueRecognizedAt.
//   Dr Accounts Receivable (full invoice total, tax included)
//   Cr Client Disbursements Recoverable (lines re-charging a billable cost at cost)
//   Cr Service Revenue (service fees and markups, net of discount)
//   Cr Tax Payable (tax charged on the service fees)
// Re-charged costs are not company revenue -- they settle the amount the
// client owed back for costs we paid on their behalf.
export async function recognizeInvoiceRevenue(tx: TxClient, invoiceId: string, createdById?: string | null) {
  const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { items: true } });
  if (invoice.revenueRecognizedAt) return;

  const t = invoiceTotals(invoice);
  if (t.total <= 0) return;
  const serviceRevenue = Math.round((t.serviceSubtotal - t.discount) * 100) / 100;

  const [ar, revenue, disbursements, taxPayable] = await Promise.all([
    ensureSystemAccount(tx, "ACCOUNTS_RECEIVABLE"),
    ensureSystemAccount(tx, "FREIGHT_REVENUE"),
    ensureSystemAccount(tx, "CLIENT_DISBURSEMENTS"),
    ensureSystemAccount(tx, "TAX_PAYABLE"),
  ]);

  const lines: PostingLine[] = [{ accountId: ar.id, direction: "DEBIT", amount: t.total }];
  if (t.recharged > 0) lines.push({ accountId: disbursements.id, direction: "CREDIT", amount: t.recharged });
  if (serviceRevenue > 0) lines.push({ accountId: revenue.id, direction: "CREDIT", amount: serviceRevenue });
  if (t.tax > 0) lines.push({ accountId: taxPayable.id, direction: "CREDIT", amount: t.tax });

  await postTransaction(tx, {
    memo: `Revenue recognized for invoice ${invoice.invoiceNumber}`,
    sourceType: "INVOICE_REVENUE",
    createdById,
    invoiceId,
    date: invoice.issueDate,
    lines,
  });

  await tx.invoice.update({ where: { id: invoiceId }, data: { revenueRecognizedAt: new Date() } });
}

// Cancelling an issued invoice: the ledger is append-only, so the revenue
// entry is undone by posting its exact mirror image. Idempotent -- guarded
// by Invoice.revenueReversedAt. Callers must make sure nothing was paid.
export async function reverseInvoiceRevenue(tx: TxClient, invoiceId: string, createdById?: string | null) {
  const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  if (!invoice.revenueRecognizedAt || invoice.revenueReversedAt) return;
  const original = await tx.ledgerTransaction.findMany({
    where: { invoiceId, sourceType: "INVOICE_REVENUE" },
    include: { lines: true },
  });
  const lines: PostingLine[] = original.flatMap((t) =>
    t.lines.map((l) => ({
      accountId: l.accountId,
      direction: (l.direction === "DEBIT" ? "CREDIT" : "DEBIT") as LedgerDirection,
      amount: Number(l.amount),
    })),
  );
  if (lines.length > 0) {
    await postTransaction(tx, {
      memo: `Invoice ${invoice.invoiceNumber} cancelled -- revenue reversed`,
      sourceType: "INVOICE_REVERSAL",
      createdById,
      invoiceId,
      lines,
    });
  }
  await tx.invoice.update({ where: { id: invoiceId }, data: { revenueReversedAt: new Date() } });
}

// ---------------------------------------------------------------------------
// Money accounts (cash box, bank accounts, mobile money)
// ---------------------------------------------------------------------------

// The cash box is the original "1000 Cash" account; it becomes the default
// money account the first time money moves, so existing data keeps working.
export async function ensureDefaultMoneyAccount(tx: TxClient) {
  const existingDefault = await tx.moneyAccount.findFirst({ where: { isDefault: true } });
  if (existingDefault) return existingDefault;
  const cash = await ensureSystemAccount(tx, "CASH");
  const linked = await tx.moneyAccount.findUnique({ where: { accountId: cash.id } });
  if (linked) return tx.moneyAccount.update({ where: { id: linked.id }, data: { isDefault: true } });
  return tx.moneyAccount.create({ data: { name: "Cash on hand", kind: "CASH", isDefault: true, accountId: cash.id } });
}

export async function createMoneyAccount(
  tx: TxClient,
  data: { name: string; kind: "CASH" | "BANK" | "MOBILE_MONEY"; bankName?: string | null; accountNumber?: string | null; currency?: string; notes?: string | null },
) {
  await ensureDefaultMoneyAccount(tx);
  const codes = await tx.account.findMany({ where: { code: { startsWith: "10" } }, select: { code: true } });
  const account = await tx.account.create({
    data: { code: nextMoneyAccountCode(codes.map((c) => c.code)), name: data.name, type: "ASSET", isSystem: true },
  });
  return tx.moneyAccount.create({
    data: {
      name: data.name,
      kind: data.kind,
      bankName: data.bankName ?? null,
      accountNumber: data.accountNumber ?? null,
      currency: data.currency ?? "USD",
      notes: data.notes ?? null,
      accountId: account.id,
    },
  });
}

/** Ledger account behind a money account (the default cash box when none is chosen). */
async function moneyLedgerAccountId(tx: TxClient, moneyAccountId: string | null | undefined): Promise<string> {
  if (moneyAccountId) {
    const m = await tx.moneyAccount.findUniqueOrThrow({ where: { id: moneyAccountId } });
    return m.accountId;
  }
  return (await ensureDefaultMoneyAccount(tx)).accountId;
}

// Invoice Paid workflow, step 2: debit the cash/bank account the money
// landed in, credit Accounts Receivable. When the payment applies a client
// advance instead of new money, the advance liability is debited. Revenue
// is recognized first if the invoice never passed through SENT, so the
// ledger stays balanced regardless of which path a user took.
export async function recordInvoicePaymentCash(tx: TxClient, paymentId: string, createdById?: string | null) {
  const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { invoice: true, advance: true } });

  await recognizeInvoiceRevenue(tx, payment.invoiceId, createdById);

  const [debitAccountId, ar] = await Promise.all([
    payment.advanceId
      ? ensureSystemAccount(tx, "CLIENT_ADVANCES").then((a) => a.id)
      : moneyLedgerAccountId(tx, payment.moneyAccountId),
    ensureSystemAccount(tx, "ACCOUNTS_RECEIVABLE"),
  ]);

  await postTransaction(tx, {
    memo: payment.advance
      ? `Advance ${payment.advance.advanceNumber} applied to invoice ${payment.invoice.invoiceNumber}`
      : `Payment received for invoice ${payment.invoice.invoiceNumber}`,
    sourceType: "INVOICE_PAYMENT",
    createdById,
    invoiceId: payment.invoiceId,
    paymentId,
    advanceId: payment.advanceId ?? undefined,
    date: payment.paidAt,
    lines: [
      { accountId: debitAccountId, direction: "DEBIT", amount: Number(payment.amount) },
      { accountId: ar.id, direction: "CREDIT", amount: Number(payment.amount) },
    ],
  });
}

// Client advance / deposit (or overpayment credit) received:
//   Dr Cash/Bank / Cr Client Advances & Credits.
export async function recordAdvanceReceipt(tx: TxClient, advanceId: string, createdById?: string | null) {
  const advance = await tx.clientAdvance.findUniqueOrThrow({ where: { id: advanceId }, include: { client: true } });
  const [money, liability] = await Promise.all([
    moneyLedgerAccountId(tx, advance.moneyAccountId),
    ensureSystemAccount(tx, "CLIENT_ADVANCES"),
  ]);
  await postTransaction(tx, {
    memo: `${advance.source === "OVERPAYMENT" ? "Overpayment credit" : "Advance"} ${advance.advanceNumber} received from ${advance.client.name}`,
    sourceType: "ADVANCE_RECEIPT",
    createdById,
    advanceId,
    date: advance.receivedAt,
    lines: [
      { accountId: money, direction: "DEBIT", amount: Number(advance.amount) },
      { accountId: liability.id, direction: "CREDIT", amount: Number(advance.amount) },
    ],
  });
}

// Unused advance paid back to the client: Dr Client Advances / Cr Cash/Bank.
export async function recordAdvanceRefund(tx: TxClient, refundId: string, createdById?: string | null) {
  const refund = await tx.advanceRefund.findUniqueOrThrow({ where: { id: refundId }, include: { advance: { include: { client: true } } } });
  const [money, liability] = await Promise.all([
    moneyLedgerAccountId(tx, refund.moneyAccountId),
    ensureSystemAccount(tx, "CLIENT_ADVANCES"),
  ]);
  await postTransaction(tx, {
    memo: `Refund of ${refund.advance.advanceNumber} to ${refund.advance.client.name}`,
    sourceType: "ADVANCE_REFUND",
    createdById,
    advanceId: refund.advanceId,
    refundId,
    date: refund.refundedAt,
    lines: [
      { accountId: liability.id, direction: "DEBIT", amount: Number(refund.amount) },
      { accountId: money, direction: "CREDIT", amount: Number(refund.amount) },
    ],
  });
}

// Supplier bill payment: Dr Accounts Payable / Cr Cash/Bank.
export async function recordSupplierPayment(tx: TxClient, supplierPaymentId: string, createdById?: string | null) {
  const p = await tx.supplierPayment.findUniqueOrThrow({ where: { id: supplierPaymentId }, include: { bill: { include: { vendor: true } } } });
  const [money, ap] = await Promise.all([moneyLedgerAccountId(tx, p.moneyAccountId), ensureSystemAccount(tx, "ACCOUNTS_PAYABLE")]);
  await postTransaction(tx, {
    memo: `Paid ${p.bill.vendor.name} -- bill ${p.bill.billNumber}${p.bill.supplierReference ? ` (${p.bill.supplierReference})` : ""}`,
    sourceType: "SUPPLIER_PAYMENT",
    createdById,
    supplierPaymentId,
    date: p.paidAt,
    lines: [
      { accountId: ap.id, direction: "DEBIT", amount: Number(p.amount) },
      { accountId: money, direction: "CREDIT", amount: Number(p.amount) },
    ],
  });
}

// Moving money between the company's own accounts: Dr destination / Cr source.
export async function recordTransfer(tx: TxClient, transferId: string, createdById?: string | null) {
  const t = await tx.moneyTransfer.findUniqueOrThrow({ where: { id: transferId }, include: { from: true, to: true } });
  await postTransaction(tx, {
    memo: `Transfer from ${t.from.name} to ${t.to.name}${t.reference ? ` (${t.reference})` : ""}`,
    sourceType: "TRANSFER",
    createdById,
    transferId,
    date: t.transferredAt,
    lines: [
      { accountId: t.to.accountId, direction: "DEBIT", amount: Number(t.amount) },
      { accountId: t.from.accountId, direction: "CREDIT", amount: Number(t.amount) },
    ],
  });
}

// Manual journal entry (opening balances, owner capital, loans,
// corrections). Lines are validated by finance-rules.checkJournal first;
// postTransaction re-checks the balance.
export async function postManualJournal(
  tx: TxClient,
  params: { memo: string; date: Date; createdById?: string | null; lines: { accountId: string; debit: number; credit: number }[] },
) {
  return postTransaction(tx, {
    memo: params.memo,
    sourceType: "MANUAL",
    createdById: params.createdById,
    date: params.date,
    lines: params.lines
      .filter((l) => l.debit > 0 || l.credit > 0)
      .map((l) => ({ accountId: l.accountId, direction: l.debit > 0 ? "DEBIT" : "CREDIT", amount: l.debit > 0 ? l.debit : l.credit })),
  });
}

// Expense incurred: recognize the liability immediately, independent of
// whether it has cleared approval yet. Idempotent -- guarded by
// Expense.accrualPostedAt.
//   Company cost:          Dr [category expense account]        / Cr Accounts Payable
//   Billable to the client: Dr Client Disbursements Recoverable / Cr Accounts Payable
// (a billable cost is recovered from the client when invoiced, so it never
// hits the company's expense accounts).
export async function accrueExpense(tx: TxClient, expenseId: string, createdById?: string | null) {
  const expense = await tx.expense.findUniqueOrThrow({ where: { id: expenseId }, include: { category: true } });
  if (expense.accrualPostedAt) return;

  const billable = expense.billingType !== "NON_BILLABLE";
  const [debitAccount, ap] = await Promise.all([
    billable
      ? ensureSystemAccount(tx, "CLIENT_DISBURSEMENTS")
      : ensureExpenseCategoryAccount(tx, expense.categoryId, expense.category.name),
    ensureSystemAccount(tx, "ACCOUNTS_PAYABLE"),
  ]);

  await postTransaction(tx, {
    memo: billable ? `Billable cost paid for client: ${expense.description}` : `Expense accrued: ${expense.description}`,
    sourceType: "EXPENSE_ACCRUAL",
    createdById,
    expenseId,
    date: expense.incurredAt,
    lines: [
      { accountId: debitAccount.id, direction: "DEBIT", amount: Number(expense.amount) },
      { accountId: ap.id, direction: "CREDIT", amount: Number(expense.amount) },
    ],
  });

  await tx.expense.update({ where: { id: expenseId }, data: { accrualPostedAt: new Date() } });
}

// Expense payout: settle the liability (Dr Accounts Payable / Cr Cash).
// This is the step gated behind managerial approval for amounts over the
// auto-pay threshold -- see lib/expense-approval.ts and expenses/actions.ts.
export async function payoutExpense(tx: TxClient, expenseId: string, createdById?: string | null) {
  const expense = await tx.expense.findUniqueOrThrow({ where: { id: expenseId } });
  if (expense.payoutPostedAt) return;

  await accrueExpense(tx, expenseId, createdById);

  const [ap, cash] = await Promise.all([
    ensureSystemAccount(tx, "ACCOUNTS_PAYABLE"),
    moneyLedgerAccountId(tx, expense.paidFromId),
  ]);

  await postTransaction(tx, {
    memo: `Expense paid: ${expense.description}`,
    sourceType: "EXPENSE_PAYOUT",
    createdById,
    expenseId,
    date: expense.paidAt ?? undefined,
    lines: [
      { accountId: ap.id, direction: "DEBIT", amount: Number(expense.amount) },
      { accountId: cash, direction: "CREDIT", amount: Number(expense.amount) },
    ],
  });

  await tx.expense.update({ where: { id: expenseId }, data: { payoutPostedAt: new Date() } });
}

// A rejected expense never becomes a cost: its accrual (Dr cost / Cr
// Accounts Payable) is reversed by posting the mirror entry. Idempotent --
// guarded by Expense.accrualReversedAt; never applied to a paid expense.
export async function reverseExpenseAccrual(tx: TxClient, expenseId: string, createdById?: string | null) {
  const expense = await tx.expense.findUniqueOrThrow({ where: { id: expenseId } });
  if (!expense.accrualPostedAt || expense.accrualReversedAt || expense.payoutPostedAt) return;
  const original = await tx.ledgerTransaction.findMany({ where: { expenseId, sourceType: "EXPENSE_ACCRUAL" }, include: { lines: true } });
  const lines: PostingLine[] = original.flatMap((t) =>
    t.lines.map((l) => ({
      accountId: l.accountId,
      direction: (l.direction === "DEBIT" ? "CREDIT" : "DEBIT") as LedgerDirection,
      amount: Number(l.amount),
    })),
  );
  if (lines.length > 0) {
    await postTransaction(tx, {
      memo: `Expense rejected -- accrual reversed: ${expense.description}`,
      sourceType: "EXPENSE_REVERSAL",
      createdById,
      expenseId,
      lines,
    });
  }
  await tx.expense.update({ where: { id: expenseId }, data: { accrualReversedAt: new Date() } });
}
