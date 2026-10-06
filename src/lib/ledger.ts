import type { Prisma } from "@/generated/prisma/client";

type TxClient = Prisma.TransactionClient;
type LedgerSourceType = "INVOICE_REVENUE" | "INVOICE_PAYMENT" | "EXPENSE_ACCRUAL" | "EXPENSE_PAYOUT" | "MANUAL";
type LedgerDirection = "DEBIT" | "CREDIT";

export class UnbalancedLedgerEntryError extends Error {}

const SYSTEM_ACCOUNTS = {
  CASH: { code: "1000", name: "Cash", type: "ASSET" as const },
  ACCOUNTS_RECEIVABLE: { code: "1100", name: "Accounts Receivable", type: "ASSET" as const },
  // Costs paid on a client's behalf that will be re-charged to them (e.g. a
  // government fee): an amount the client owes back, not a company expense.
  CLIENT_DISBURSEMENTS: { code: "1200", name: "Client Disbursements Recoverable", type: "ASSET" as const },
  ACCOUNTS_PAYABLE: { code: "2000", name: "Accounts Payable", type: "LIABILITY" as const },
  FREIGHT_REVENUE: { code: "4000", name: "Service Revenue", type: "REVENUE" as const },
};

async function ensureSystemAccount(tx: TxClient, key: keyof typeof SYSTEM_ACCOUNTS) {
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
    lines: { accountId: string; direction: LedgerDirection; amount: number }[];
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
      lines: {
        create: params.lines.map((l) => ({
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
//   Dr Accounts Receivable (full invoice total)
//   Cr Client Disbursements Recoverable (lines re-charging a billable cost at cost)
//   Cr Service Revenue (everything else: service fees, markups)
// Re-charged costs are not company revenue -- they settle the amount the
// client owed back for costs we paid on their behalf.
export async function recognizeInvoiceRevenue(tx: TxClient, invoiceId: string, createdById?: string | null) {
  const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { items: true } });
  if (invoice.revenueRecognizedAt) return;

  const lineTotal = (item: { quantity: unknown; unitPrice: unknown }) => Number(item.quantity) * Number(item.unitPrice);
  const total = invoice.items.reduce((sum, item) => sum + lineTotal(item), 0);
  if (total <= 0) return;
  const recharged = invoice.items.filter((i) => i.sourceExpenseId).reduce((sum, item) => sum + lineTotal(item), 0);
  const serviceRevenue = total - recharged;

  const [ar, revenue, disbursements] = await Promise.all([
    ensureSystemAccount(tx, "ACCOUNTS_RECEIVABLE"),
    ensureSystemAccount(tx, "FREIGHT_REVENUE"),
    ensureSystemAccount(tx, "CLIENT_DISBURSEMENTS"),
  ]);

  const lines: { accountId: string; direction: LedgerDirection; amount: number }[] = [
    { accountId: ar.id, direction: "DEBIT", amount: total },
  ];
  if (recharged > 0) lines.push({ accountId: disbursements.id, direction: "CREDIT", amount: recharged });
  if (serviceRevenue > 0) lines.push({ accountId: revenue.id, direction: "CREDIT", amount: serviceRevenue });

  await postTransaction(tx, {
    memo: `Revenue recognized for invoice ${invoice.invoiceNumber}`,
    sourceType: "INVOICE_REVENUE",
    createdById,
    invoiceId,
    lines,
  });

  await tx.invoice.update({ where: { id: invoiceId }, data: { revenueRecognizedAt: new Date() } });
}

// Invoice Paid workflow, step 2: debit Cash, credit Accounts Receivable
// for the payment amount. Revenue is recognized first if the invoice
// somehow never passed through SENT, so the ledger stays balanced
// regardless of which path a user took to get here.
export async function recordInvoicePaymentCash(tx: TxClient, paymentId: string, createdById?: string | null) {
  const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { invoice: true } });

  await recognizeInvoiceRevenue(tx, payment.invoiceId, createdById);

  const [cash, ar] = await Promise.all([
    ensureSystemAccount(tx, "CASH"),
    ensureSystemAccount(tx, "ACCOUNTS_RECEIVABLE"),
  ]);

  await postTransaction(tx, {
    memo: `Payment received for invoice ${payment.invoice.invoiceNumber}`,
    sourceType: "INVOICE_PAYMENT",
    createdById,
    invoiceId: payment.invoiceId,
    paymentId,
    lines: [
      { accountId: cash.id, direction: "DEBIT", amount: Number(payment.amount) },
      { accountId: ar.id, direction: "CREDIT", amount: Number(payment.amount) },
    ],
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
    ensureSystemAccount(tx, "CASH"),
  ]);

  await postTransaction(tx, {
    memo: `Expense paid: ${expense.description}`,
    sourceType: "EXPENSE_PAYOUT",
    createdById,
    expenseId,
    lines: [
      { accountId: ap.id, direction: "DEBIT", amount: Number(expense.amount) },
      { accountId: cash.id, direction: "CREDIT", amount: Number(expense.amount) },
    ],
  });

  await tx.expense.update({ where: { id: expenseId }, data: { payoutPostedAt: new Date() } });
}
