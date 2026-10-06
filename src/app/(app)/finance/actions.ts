"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireStaff } from "@/lib/session";
import { audit } from "@/lib/audit";
import { nextFinanceNumber } from "@/lib/numbering";
import {
  accrueExpense,
  createMoneyAccount,
  postManualJournal,
  recordAdvanceReceipt,
  recordAdvanceRefund,
  recordInvoicePaymentCash,
  recordSupplierPayment,
  recordTransfer,
  reverseExpenseAccrual,
} from "@/lib/ledger";
import { advanceRemaining, billFigures, syncBillStatus, syncInvoiceStatus } from "@/lib/finance";
import { businessDate, checkAdvanceApplication, checkJournal, checkRefund, checkSupplierPayment, FinanceRuleError } from "@/lib/finance-rules";
import { decideExpenseStatus } from "@/lib/expense-approval";
import { invoiceBalance } from "@/lib/invoices";
import { uploadJobFile } from "@/lib/blob";

type State = { error: string | null };
const ok: State = { error: null };
const methods = ["BANK_TRANSFER", "CASH", "CHECK", "CARD", "MOBILE_MONEY", "OTHER"] as const;
const opt = z.string().optional().or(z.literal(""));
const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "Invalid input";

function refreshFinance() {
  revalidatePath("/finance");
  revalidatePath("/");
}

async function guarded(fn: () => Promise<void>): Promise<State> {
  try {
    await fn();
    return ok;
  } catch (e) {
    if (e instanceof FinanceRuleError) return { error: e.message };
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Cash / bank / mobile money accounts
// ---------------------------------------------------------------------------

const moneyAccountSchema = z.object({
  name: z.string().trim().min(1, "Name the account (e.g. \"KCB USD account\")"),
  kind: z.enum(["CASH", "BANK", "MOBILE_MONEY"]),
  bankName: opt,
  accountNumber: opt,
  currency: z.string().trim().min(3).max(3).default("USD"),
  notes: opt,
});

export async function createMoneyAccountAction(_prev: State, formData: FormData): Promise<State> {
  const user = await requireAdmin();
  const parsed = moneyAccountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  if (await prisma.moneyAccount.findUnique({ where: { name: d.name } })) return { error: "An account with that name already exists." };
  await prisma.$transaction(async (tx) => {
    const acct = await createMoneyAccount(tx, { ...d, currency: d.currency.toUpperCase(), bankName: d.bankName || null, accountNumber: d.accountNumber || null, notes: d.notes || null });
    await audit(tx, user, { action: "MONEY_ACCOUNT_CREATED", module: "Finance", entityType: "MoneyAccount", entityId: acct.id, message: `Added ${d.kind.toLowerCase().replace("_", " ")} account "${d.name}".` });
  });
  refreshFinance();
  return ok;
}

const transferSchema = z.object({
  fromId: z.string().min(1, "Choose the account the money leaves"),
  toId: z.string().min(1, "Choose the account the money goes to"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  transferredAt: z.string().min(1, "Date is required"),
  reference: opt,
  notes: opt,
});

export async function transferAction(_prev: State, formData: FormData): Promise<State> {
  const user = await requireAdmin();
  const parsed = transferSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  if (d.fromId === d.toId) return { error: "Choose two different accounts." };
  await prisma.$transaction(async (tx) => {
    const t = await tx.moneyTransfer.create({
      data: { fromId: d.fromId, toId: d.toId, amount: d.amount, transferredAt: businessDate(d.transferredAt), reference: d.reference || null, notes: d.notes || null },
      include: { from: true, to: true },
    });
    await recordTransfer(tx, t.id, user.id);
    await audit(tx, user, { action: "MONEY_TRANSFERRED", module: "Finance", entityType: "MoneyTransfer", entityId: t.id, message: `Transferred ${d.amount.toFixed(2)} from ${t.from.name} to ${t.to.name}.` });
  });
  refreshFinance();
  return ok;
}

// ---------------------------------------------------------------------------
// Client advances, credits and refunds
// ---------------------------------------------------------------------------

const advanceSchema = z.object({
  clientId: z.string().min(1, "Choose the client"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  receivedAt: z.string().min(1, "Date is required"),
  method: z.enum(methods),
  moneyAccountId: opt,
  reference: opt,
  jobId: opt,
  notes: opt,
});

// Money received before invoicing: Dr Cash/Bank / Cr Client Advances (a
// liability -- not revenue until it settles an invoice).
export async function receiveAdvanceAction(_prev: State, formData: FormData): Promise<State> {
  const user = await requireStaff();
  const parsed = advanceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  if (d.jobId) {
    const job = await prisma.job.findUnique({ where: { id: d.jobId } });
    if (!job || job.clientId !== d.clientId) return { error: "That job belongs to a different client." };
  }
  const advance = await prisma.$transaction(async (tx) => {
    const a = await tx.clientAdvance.create({
      data: {
        advanceNumber: await nextFinanceNumber(tx, "ADV"),
        clientId: d.clientId,
        amount: d.amount,
        receivedAt: businessDate(d.receivedAt),
        method: d.method,
        moneyAccountId: d.moneyAccountId || null,
        reference: d.reference || null,
        jobId: d.jobId || null,
        notes: d.notes || null,
      },
      include: { client: true, job: true },
    });
    await recordAdvanceReceipt(tx, a.id, user.id);
    await audit(tx, user, {
      action: "ADVANCE_RECEIVED",
      module: "Finance",
      entityType: "ClientAdvance",
      entityId: a.id,
      reference: a.advanceNumber,
      jobId: a.jobId,
      message: `Received advance ${a.advanceNumber} of ${d.amount.toFixed(2)} from ${a.client.name}${a.job ? ` for ${a.job.jobNumber}` : ""}.`,
    });
    return a;
  });
  refreshFinance();
  revalidatePath("/finance/advances");
  redirect(`/finance/advances/${advance.id}`);
}

export async function applyAdvanceToInvoiceAction(advanceId: string, _prev: State, formData: FormData): Promise<State> {
  const user = await requireStaff();
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const amount = Number(formData.get("amount"));
  if (!invoiceId) return { error: "Choose the invoice to settle." };
  const [advance, invoice] = await Promise.all([
    prisma.clientAdvance.findUniqueOrThrow({ where: { id: advanceId } }),
    prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { items: true, payments: true } }),
  ]);
  if (invoice.clientId !== advance.clientId) return { error: "That invoice belongs to a different client." };
  if (invoice.status === "CANCELLED") return { error: "That invoice is cancelled." };
  const result = await guarded(async () => {
    await prisma.$transaction(async (tx) => {
      const { remaining } = await advanceRemaining(tx, advanceId);
      const problem = checkAdvanceApplication(amount, remaining, invoiceBalance(invoice));
      if (problem) throw new FinanceRuleError(problem);
      const payment = await tx.payment.create({ data: { invoiceId, amount, method: "ADVANCE", advanceId, reference: advance.advanceNumber, paidAt: new Date() } });
      await recordInvoicePaymentCash(tx, payment.id, user.id);
      await syncInvoiceStatus(tx, invoiceId);
      await audit(tx, user, {
        action: "ADVANCE_APPLIED",
        module: "Billing",
        entityType: "Invoice",
        entityId: invoiceId,
        reference: invoice.invoiceNumber,
        message: `Applied ${amount.toFixed(2)} from client advance ${advance.advanceNumber} to invoice ${invoice.invoiceNumber}.`,
      });
    });
  });
  revalidatePath(`/finance/advances/${advanceId}`);
  revalidatePath(`/invoices/${invoiceId}`);
  refreshFinance();
  return result;
}

const refundSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  refundedAt: z.string().min(1, "Date is required"),
  method: z.enum(methods),
  moneyAccountId: opt,
  reference: opt,
  reason: z.string().trim().min(1, "Give a reason for the refund"),
});

// Paying unused credit back to the client: Dr Client Advances / Cr Cash/Bank. Managers only.
export async function refundAdvanceAction(advanceId: string, _prev: State, formData: FormData): Promise<State> {
  const user = await requireAdmin();
  const parsed = refundSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  const result = await guarded(async () => {
    await prisma.$transaction(async (tx) => {
      const advance = await tx.clientAdvance.findUniqueOrThrow({ where: { id: advanceId }, include: { client: true } });
      const { remaining } = await advanceRemaining(tx, advanceId);
      const problem = checkRefund(d.amount, remaining);
      if (problem) throw new FinanceRuleError(problem);
      const refund = await tx.advanceRefund.create({
        data: { advanceId, amount: d.amount, refundedAt: businessDate(d.refundedAt), method: d.method, moneyAccountId: d.moneyAccountId || null, reference: d.reference || null, reason: d.reason },
      });
      await recordAdvanceRefund(tx, refund.id, user.id);
      await audit(tx, user, {
        action: "ADVANCE_REFUNDED",
        module: "Finance",
        entityType: "ClientAdvance",
        entityId: advanceId,
        reference: advance.advanceNumber,
        message: `Refunded ${d.amount.toFixed(2)} of ${advance.advanceNumber} to ${advance.client.name}: ${d.reason}`,
      });
    });
  });
  revalidatePath(`/finance/advances/${advanceId}`);
  revalidatePath("/finance/advances");
  refreshFinance();
  return result;
}

// ---------------------------------------------------------------------------
// Supplier bills
// ---------------------------------------------------------------------------

const billSchema = z.object({
  vendorId: z.string().min(1, "Choose the supplier"),
  supplierReference: opt,
  billDate: z.string().min(1, "Bill date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  notes: opt,
});
const billLineSchema = z.object({
  description: z.string().trim().min(1, "Each line needs a description"),
  categoryName: z.string().trim().min(1, "Each line needs a category"),
  amount: z.coerce.number().positive("Each line needs an amount greater than zero"),
  jobId: z.string(),
  billingType: z.enum(["NON_BILLABLE", "BILLABLE", "BILLABLE_WITH_MARKUP"]),
  markupAmount: z.coerce.number().min(0),
});

// A supplier's invoice: each line becomes an expense (job, category,
// billable or not) accrued to Accounts Payable; the bill is then settled
// by one or more supplier payments.
export async function createBillAction(_prev: State, formData: FormData): Promise<State> {
  const user = await requireStaff();
  const parsed = billSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;

  const col = (k: string) => formData.getAll(`${k}[]`).map(String);
  const descriptions = col("description");
  const rawLines = descriptions
    .map((description, i) => ({
      description,
      categoryName: col("categoryName")[i] ?? "",
      amount: col("amount")[i] ?? "",
      jobId: col("jobId")[i] ?? "",
      billingType: col("billingType")[i] || "NON_BILLABLE",
      markupAmount: col("markupAmount")[i] || "0",
    }))
    .filter((l) => l.description.trim() !== "" || l.amount !== "");
  if (rawLines.length === 0) return { error: "Add at least one line." };
  const lines: z.infer<typeof billLineSchema>[] = [];
  for (const raw of rawLines) {
    const l = billLineSchema.safeParse(raw);
    if (!l.success) return { error: firstError(l.error) };
    if (l.data.billingType !== "NON_BILLABLE" && !l.data.jobId) return { error: `"${l.data.description}" is billable -- choose the job it is re-charged on.` };
    if (l.data.billingType === "BILLABLE_WITH_MARKUP" && l.data.markupAmount <= 0) return { error: `Enter the handling fee for "${l.data.description}".` };
    lines.push(l.data);
  }
  const jobIds = [...new Set(lines.map((l) => l.jobId).filter(Boolean))];
  const jobs = await prisma.job.findMany({ where: { id: { in: jobIds } } });
  for (const j of jobs) {
    if (j.status === "CLOSED" || j.status === "CANCELLED") return { error: `${j.jobNumber} is ${j.status.toLowerCase()} -- costs can't be added to it.` };
  }
  const jobClient = new Map(jobs.map((j) => [j.id, j.clientId]));

  let attachment: { url: string; fileName: string } | null = null;
  const file = formData.get("attachment");
  if (file instanceof File && file.size > 0) {
    if (file.size > 4 * 1024 * 1024) return { error: "The attachment is too large (max 4 MB)." };
    try {
      attachment = await uploadJobFile(file, "supplier-bills");
    } catch {
      return { error: "The attachment could not be uploaded -- file storage isn't configured. Save the bill without it." };
    }
  }

  const bill = await prisma.$transaction(async (tx) => {
    const vendor = await tx.vendor.findUniqueOrThrow({ where: { id: d.vendorId } });
    const created = await tx.supplierBill.create({
      data: {
        billNumber: await nextFinanceNumber(tx, "BILL"),
        vendorId: d.vendorId,
        supplierReference: d.supplierReference || null,
        billDate: new Date(d.billDate),
        dueDate: new Date(d.dueDate),
        notes: d.notes || null,
        attachmentUrl: attachment?.url ?? null,
        attachmentName: attachment?.fileName ?? null,
      },
    });
    for (const l of lines) {
      const category = await tx.expenseCategory.upsert({ where: { name: l.categoryName }, update: {}, create: { name: l.categoryName } });
      const expense = await tx.expense.create({
        data: {
          expenseNumber: await nextFinanceNumber(tx, "EXP"),
          description: l.description,
          amount: l.amount,
          categoryId: category.id,
          vendorId: d.vendorId,
          status: decideExpenseStatus(l.amount, "PENDING"),
          incurredAt: new Date(d.billDate),
          jobId: l.jobId || null,
          clientId: l.jobId ? (jobClient.get(l.jobId) ?? null) : null,
          billingType: l.billingType,
          markupAmount: l.billingType === "BILLABLE_WITH_MARKUP" ? l.markupAmount : 0,
          supplierBillId: created.id,
        },
      });
      await accrueExpense(tx, expense.id, user.id);
    }
    const total = lines.reduce((s, l) => s + l.amount, 0);
    await audit(tx, user, {
      action: "SUPPLIER_BILL_RECORDED",
      module: "Finance",
      entityType: "SupplierBill",
      entityId: created.id,
      reference: created.billNumber,
      message: `Recorded bill ${created.billNumber}${d.supplierReference ? ` (${d.supplierReference})` : ""} from ${vendor.name}: ${lines.length} line(s), ${total.toFixed(2)}.`,
    });
    return created;
  });
  revalidatePath("/finance/bills");
  revalidatePath("/expenses");
  for (const id of jobIds) revalidatePath(`/jobs/${id}`);
  refreshFinance();
  redirect(`/finance/bills/${bill.id}`);
}

const supplierPaymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  paidAt: z.string().min(1, "Date is required"),
  method: z.enum(methods),
  moneyAccountId: opt,
  reference: opt,
});

// Paying a supplier: Dr Accounts Payable / Cr Cash/Bank. Partial payments allowed.
export async function paySupplierBillAction(billId: string, _prev: State, formData: FormData): Promise<State> {
  const user = await requireStaff();
  const parsed = supplierPaymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  const result = await guarded(async () => {
    await prisma.$transaction(async (tx) => {
      const f = await billFigures(tx, billId);
      if (f.bill.status === "CANCELLED") throw new FinanceRuleError("This bill is cancelled.");
      const problem = checkSupplierPayment(d.amount, f.balance, f.awaitingApproval);
      if (problem) throw new FinanceRuleError(problem);
      const payment = await tx.supplierPayment.create({
        data: { billId, amount: d.amount, paidAt: businessDate(d.paidAt), method: d.method, moneyAccountId: d.moneyAccountId || null, reference: d.reference || null },
      });
      await recordSupplierPayment(tx, payment.id, user.id);
      await syncBillStatus(tx, billId);
      await audit(tx, user, {
        action: "SUPPLIER_PAID",
        module: "Finance",
        entityType: "SupplierBill",
        entityId: billId,
        reference: f.bill.billNumber,
        message: `Paid ${d.amount.toFixed(2)} against bill ${f.bill.billNumber}.`,
      });
    });
  });
  revalidatePath(`/finance/bills/${billId}`);
  revalidatePath("/finance/bills");
  revalidatePath("/expenses");
  refreshFinance();
  return result;
}

// A bill entered in error: its lines are rejected and their accruals reversed. Only while unpaid.
export async function cancelBillAction(billId: string, _prev: State, formData: FormData): Promise<State> {
  const user = await requireAdmin();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Give a reason for cancelling the bill." };
  const result = await guarded(async () => {
    await prisma.$transaction(async (tx) => {
      const f = await billFigures(tx, billId);
      if (f.bill.status === "CANCELLED") return;
      if (f.paid > 0) throw new FinanceRuleError("This bill has payments -- it can't be cancelled.");
      const lines = await tx.expense.findMany({ where: { supplierBillId: billId }, include: { invoiceItem: { include: { invoice: true } } } });
      const billed = lines.find((l) => l.invoiceItem && l.invoiceItem.invoice.status !== "CANCELLED");
      if (billed) throw new FinanceRuleError(`"${billed.description}" is already re-charged on invoice ${billed.invoiceItem!.invoice.invoiceNumber}.`);
      for (const l of lines) {
        if (l.status === "REJECTED") continue;
        await tx.expense.update({ where: { id: l.id }, data: { status: "REJECTED", rejectedReason: `Bill cancelled: ${reason}`, approvedById: user.id, approvedAt: new Date() } });
        await reverseExpenseAccrual(tx, l.id, user.id);
      }
      await tx.supplierBill.update({ where: { id: billId }, data: { status: "CANCELLED", notes: [f.bill.notes, `Cancelled: ${reason}`].filter(Boolean).join("\n") } });
      await audit(tx, user, { action: "SUPPLIER_BILL_CANCELLED", module: "Finance", entityType: "SupplierBill", entityId: billId, reference: f.bill.billNumber, message: `Cancelled bill ${f.bill.billNumber}: ${reason}` });
    });
  });
  revalidatePath(`/finance/bills/${billId}`);
  revalidatePath("/finance/bills");
  refreshFinance();
  return result;
}

// ---------------------------------------------------------------------------
// Chart of accounts and manual journal entries (managers)
// ---------------------------------------------------------------------------

const accountSchema = z.object({
  code: z.string().trim().regex(/^\d{3,6}$/, "Use a numeric code (e.g. 1500)"),
  name: z.string().trim().min(1, "Name the account"),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
});

export async function createAccountAction(_prev: State, formData: FormData): Promise<State> {
  const user = await requireAdmin();
  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  if (/^10\d\d$/.test(d.code)) return { error: "Codes 1000-1099 are for cash and bank accounts -- add those under Finance → Accounts." };
  if (await prisma.account.findUnique({ where: { code: d.code } })) return { error: `Account ${d.code} already exists.` };
  await prisma.$transaction(async (tx) => {
    const a = await tx.account.create({ data: d });
    await audit(tx, user, { action: "ACCOUNT_CREATED", module: "Finance", entityType: "Account", entityId: a.id, message: `Added account ${d.code} ${d.name} (${d.type.toLowerCase()}).` });
  });
  revalidatePath("/finance/journal");
  revalidatePath("/accounting");
  return ok;
}

export async function postJournalAction(_prev: State, formData: FormData): Promise<State> {
  const user = await requireAdmin();
  const memo = String(formData.get("memo") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  if (!memo) return { error: "Describe the entry (e.g. \"Opening bank balance\")." };
  if (!date) return { error: "Date is required." };
  const accountIds = formData.getAll("accountId[]").map(String);
  const debits = formData.getAll("debit[]").map((v) => Number(v) || 0);
  const credits = formData.getAll("credit[]").map((v) => Number(v) || 0);
  const lines = accountIds.map((accountId, i) => ({ accountId, debit: debits[i] ?? 0, credit: credits[i] ?? 0 })).filter((l) => l.accountId);
  const problem = checkJournal(lines);
  if (problem) return { error: problem };
  const used = lines.filter((l) => l.debit > 0 || l.credit > 0);
  const total = used.reduce((s, l) => s + l.debit, 0);
  await prisma.$transaction(async (tx) => {
    const t = await postManualJournal(tx, { memo, date: businessDate(date), createdById: user.id, lines: used });
    await audit(tx, user, { action: "JOURNAL_POSTED", module: "Finance", entityType: "LedgerTransaction", entityId: t.id, message: `Posted journal entry "${memo}" for ${total.toFixed(2)}.` });
  });
  revalidatePath("/finance/journal");
  revalidatePath("/accounting");
  refreshFinance();
  return ok;
}
