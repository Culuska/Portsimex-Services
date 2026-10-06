"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireStaff } from "@/lib/session";
import { accrueExpense, payoutExpense, reverseExpenseAccrual } from "@/lib/ledger";
import { nextFinanceNumber } from "@/lib/numbering";
import { uploadJobFile } from "@/lib/blob";
import { assertCanTransitionExpenseStatus, decideExpenseStatus } from "@/lib/expense-approval";
import { audit } from "@/lib/audit";
import { isExpenseBilled, type InvoiceStatus } from "@/lib/job-finance";
import { syncBillStatus } from "@/lib/finance";
import { businessDate } from "@/lib/finance-rules";

const billingTypes = ["NON_BILLABLE", "BILLABLE", "BILLABLE_WITH_MARKUP"] as const;

// Cost attribution rules shared by create and update: a cost re-charged to
// a client must belong to a job (that's who gets invoiced), and only the
// "cost + handling fee" type carries a markup.
async function resolveAttribution(input: {
  jobId: string;
  billingType: (typeof billingTypes)[number];
  markupAmount: number | "";
}): Promise<{ error: string } | { jobId: string | null; clientId: string | null; markupAmount: number }> {
  if (input.billingType !== "NON_BILLABLE" && !input.jobId) {
    return { error: "Choose the job this cost is re-charged on -- that's the client who will be invoiced." };
  }
  let clientId: string | null = null;
  if (input.jobId) {
    const job = await prisma.job.findUnique({ where: { id: input.jobId } });
    if (!job) return { error: "Job not found." };
    if (job.status === "CLOSED" || job.status === "CANCELLED") return { error: `${job.jobNumber} is ${job.status.toLowerCase()} -- costs can't be added to it.` };
    clientId = job.clientId;
  }
  const markup = input.markupAmount === "" ? 0 : input.markupAmount;
  if (input.billingType === "BILLABLE_WITH_MARKUP" && markup <= 0) return { error: "Enter the handling / service fee to add on top of the cost." };
  return { jobId: input.jobId || null, clientId, markupAmount: input.billingType === "BILLABLE_WITH_MARKUP" ? markup : 0 };
}

const expenseStatuses = ["PENDING", "PAID"] as const;
const payMethods = ["BANK_TRANSFER", "CASH", "CHECK", "CARD", "MOBILE_MONEY", "OTHER"] as const;

// Where the money for a paid expense came from (cash box, bank...).
function paymentSource(formData: FormData) {
  const paidFromId = String(formData.get("paidFromId") ?? "") || null;
  const m = String(formData.get("paymentMethod") ?? "");
  const paymentMethod = (payMethods as readonly string[]).includes(m) ? (m as (typeof payMethods)[number]) : null;
  return { paidFromId, paymentMethod };
}

const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;

const createExpenseSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  categoryName: z.string().min(1, "Category is required"),
  vendorId: z.string().optional().or(z.literal("")),
  shipmentId: z.string().optional().or(z.literal("")),
  status: z.enum(expenseStatuses),
  incurredAt: z.string().min(1, "Date is required"),
  jobId: z.string(),
  billingType: z.enum(billingTypes, { message: "Choose who pays for this cost" }),
  markupAmount: z.union([z.literal(""), z.coerce.number().min(0, "The handling fee can't be negative")]),
});

// Amount and category are locked after creation once the expense has been
// accrued to the ledger (every expense, immediately) -- editing a posted
// financial fact would silently desync the ledger balance, so only the
// non-financial fields and the workflow status stay editable here.
const updateExpenseSchema = z.object({
  description: z.string().min(1, "Description is required"),
  vendorId: z.string().optional().or(z.literal("")),
  shipmentId: z.string().optional().or(z.literal("")),
  // Not rendered at all once the expense has left PENDING (ExpenseForm's
  // lockStatus) -- formData.get() then returns null, which z.enum()
  // rejects outright, so this has to be optional rather than required.
  status: z.enum(expenseStatuses).optional(),
  incurredAt: z.string().min(1, "Date is required"),
  jobId: z.string(),
  markupAmount: z.union([z.literal(""), z.coerce.number().min(0, "The handling fee can't be negative")]),
});

const rejectExpenseSchema = z.object({
  reason: z.string().min(1, "A reason is required"),
});

export async function createExpenseAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const user = await requireStaff();
  const parsed = createExpenseSchema.safeParse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    categoryName: formData.get("categoryName"),
    vendorId: formData.get("vendorId"),
    shipmentId: formData.get("shipmentId"),
    status: formData.get("status"),
    incurredAt: formData.get("incurredAt"),
    jobId: formData.get("jobId") ?? "",
    billingType: formData.get("billingType"),
    markupAmount: formData.get("markupAmount") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const attribution = await resolveAttribution(parsed.data);
  if ("error" in attribution) return attribution;

  const status = decideExpenseStatus(parsed.data.amount, parsed.data.status);
  const source = paymentSource(formData);

  let receipt: { url: string; fileName: string } | null = null;
  const file = formData.get("receipt");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_RECEIPT_BYTES) return { error: "The receipt file is too large (max 4 MB)." };
    try {
      receipt = await uploadJobFile(file, attribution.jobId ?? "expenses");
    } catch {
      return { error: "The receipt could not be uploaded -- file storage isn't configured. Save without it and attach it later." };
    }
  }

  const expense = await prisma.$transaction(async (tx) => {
    const category = await tx.expenseCategory.upsert({
      where: { name: parsed.data.categoryName.trim() },
      update: {},
      create: { name: parsed.data.categoryName.trim() },
    });

    const created = await tx.expense.create({
      data: {
        description: parsed.data.description,
        amount: parsed.data.amount,
        categoryId: category.id,
        vendorId: parsed.data.vendorId || null,
        shipmentId: parsed.data.shipmentId || null,
        status,
        incurredAt: businessDate(parsed.data.incurredAt),
        paidAt: status === "PAID" ? new Date() : null,
        jobId: attribution.jobId,
        clientId: attribution.clientId,
        billingType: parsed.data.billingType,
        markupAmount: attribution.markupAmount,
        expenseNumber: await nextFinanceNumber(tx, "EXP"),
        paidFromId: status === "PAID" ? source.paidFromId : null,
        paymentMethod: status === "PAID" ? source.paymentMethod : null,
        receiptUrl: receipt?.url ?? null,
        receiptName: receipt?.fileName ?? null,
      },
      include: { job: true },
    });
    await audit(tx, user, {
      action: "EXPENSE_RECORDED",
      module: "Expenses",
      entityType: "Expense",
      entityId: created.id,
      reference: created.job?.jobNumber ?? null,
      jobId: created.jobId,
      message: `Recorded ${parsed.data.billingType === "NON_BILLABLE" ? "company cost" : "billable cost"} "${created.description}" of ${parsed.data.amount.toFixed(2)}${created.job ? ` on ${created.job.jobNumber}` : ""} (${status}).`,
    });

    // The liability is incurred the moment the cost exists, regardless of
    // approval/payout timing.
    await accrueExpense(tx, created.id, user.id);
    if (status === "PAID") {
      await payoutExpense(tx, created.id, user.id);
    }

    return created;
  });

  revalidatePath("/expenses");
  if (expense.jobId) {
    revalidatePath(`/jobs/${expense.jobId}`);
    redirect(`/jobs/${expense.jobId}`);
  }
  redirect(`/expenses/${expense.id}`);
}

export async function updateExpenseAction(
  id: string,
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const user = await requireStaff();
  const parsed = updateExpenseSchema.safeParse({
    description: formData.get("description"),
    vendorId: formData.get("vendorId"),
    shipmentId: formData.get("shipmentId"),
    status: formData.get("status") || undefined,
    incurredAt: formData.get("incurredAt"),
    jobId: formData.get("jobId") ?? "",
    markupAmount: formData.get("markupAmount") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const existing = await prisma.expense.findUniqueOrThrow({
    where: { id },
    include: { invoiceItem: { include: { invoice: true } } },
  });
  // Billing type is fixed once accrued (it decided the ledger account); job
  // and markup are fixed once the cost is on a live invoice.
  const billed = isExpenseBilled((existing.invoiceItem?.invoice.status as InvoiceStatus | undefined) ?? null);
  const attribution = billed
    ? { jobId: existing.jobId, clientId: existing.clientId, markupAmount: Number(existing.markupAmount) }
    : await resolveAttribution({ jobId: parsed.data.jobId, billingType: existing.billingType, markupAmount: parsed.data.markupAmount });
  if ("error" in attribution) return attribution;

  // Once an expense has left PENDING (queued for approval or already
  // paid), status only changes through the dedicated approve/reject/pay
  // actions below -- this form can't be used to skip the approval queue.
  // (parsed.data.status is only ever present when the status select was
  // actually rendered, i.e. existing.status === "PENDING".)
  const nextStatus =
    existing.status === "PENDING" && parsed.data.status
      ? decideExpenseStatus(Number(existing.amount), parsed.data.status)
      : existing.status;

  if (nextStatus !== existing.status) {
    assertCanTransitionExpenseStatus(existing.status, nextStatus);
  }
  if (nextStatus === "PAID" && existing.status !== "PAID" && existing.supplierBillId) {
    return { error: "This cost is a line on a supplier bill -- it is paid through the bill." };
  }
  const source = paymentSource(formData);

  await prisma.$transaction(async (tx) => {
    await tx.expense.update({
      where: { id },
      data: {
        description: parsed.data.description,
        vendorId: parsed.data.vendorId || null,
        shipmentId: parsed.data.shipmentId || null,
        status: nextStatus,
        incurredAt: businessDate(parsed.data.incurredAt),
        paidAt: nextStatus === "PAID" ? (existing.paidAt ?? new Date()) : existing.paidAt,
        ...(nextStatus === "PAID" && existing.status !== "PAID" ? { paidFromId: source.paidFromId, paymentMethod: source.paymentMethod } : {}),
        jobId: attribution.jobId,
        clientId: attribution.clientId,
        markupAmount: attribution.markupAmount,
      },
    });

    if (nextStatus === "PAID") {
      await payoutExpense(tx, id, user.id);
    }
  });

  revalidatePath("/expenses");
  revalidatePath(`/expenses/${id}`);
  return { error: null };
}

// Managerial approval step: required before an expense over the auto-pay
// threshold can be paid out.
export async function approveExpenseAction(id: string) {
  const admin = await requireAdmin();
  const expense = await prisma.expense.findUniqueOrThrow({ where: { id } });
  assertCanTransitionExpenseStatus(expense.status, "APPROVED");

  await prisma.$transaction(async (tx) => {
    await tx.expense.update({
      where: { id },
      data: { status: "APPROVED", approvedById: admin.id, approvedAt: new Date(), rejectedReason: null },
    });
    await audit(tx, admin, {
      action: "EXPENSE_APPROVED",
      module: "Expenses",
      entityType: "Expense",
      entityId: id,
      jobId: expense.jobId,
      message: `Approved expense "${expense.description}" of ${Number(expense.amount).toFixed(2)}.`,
    });
  });

  revalidatePath(`/expenses/${id}`);
  revalidatePath("/expenses");
}

export async function rejectExpenseAction(
  id: string,
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const admin = await requireAdmin();
  const parsed = rejectExpenseSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const expense = await prisma.expense.findUniqueOrThrow({ where: { id }, include: { supplierBill: { include: { payments: true } } } });
  assertCanTransitionExpenseStatus(expense.status, "REJECTED");
  if (expense.supplierBill && expense.supplierBill.payments.length > 0) {
    return { error: `Bill ${expense.supplierBill.billNumber} already has payments -- a line on it can't be rejected now.` };
  }

  await prisma.$transaction(async (tx) => {
    await tx.expense.update({
      where: { id },
      data: {
        status: "REJECTED",
        approvedById: admin.id,
        approvedAt: new Date(),
        rejectedReason: parsed.data.reason,
      },
    });
    // A rejected cost is not a cost: undo its accrual (Dr AP / Cr cost).
    await reverseExpenseAccrual(tx, id, admin.id);
    if (expense.supplierBillId) await syncBillStatus(tx, expense.supplierBillId);
    await audit(tx, admin, {
      action: "EXPENSE_REJECTED",
      module: "Expenses",
      entityType: "Expense",
      entityId: id,
      jobId: expense.jobId,
      message: `Rejected expense "${expense.description}": ${parsed.data.reason}`,
    });
  });

  revalidatePath(`/expenses/${id}`);
  revalidatePath("/expenses");
  return { error: null };
}

export async function payExpenseAction(id: string, formData?: FormData) {
  const user = await requireStaff();
  const expense = await prisma.expense.findUniqueOrThrow({ where: { id } });
  assertCanTransitionExpenseStatus(expense.status, "PAID");
  if (expense.supplierBillId) throw new Error("This cost is a line on a supplier bill -- pay it through the bill.");
  const source = formData ? paymentSource(formData) : { paidFromId: null, paymentMethod: null };

  await prisma.$transaction(async (tx) => {
    await tx.expense.update({ where: { id }, data: { status: "PAID", paidAt: new Date(), ...source } });
    await payoutExpense(tx, id, user.id);
    await audit(tx, user, {
      action: "EXPENSE_PAID",
      module: "Expenses",
      entityType: "Expense",
      entityId: id,
      jobId: expense.jobId,
      message: `Paid expense "${expense.description}" of ${Number(expense.amount).toFixed(2)}.`,
    });
  });

  revalidatePath(`/expenses/${id}`);
  revalidatePath("/expenses");
}
