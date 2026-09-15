"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/session";
import { accrueExpense, payoutExpense } from "@/lib/ledger";
import { assertCanTransitionExpenseStatus, decideExpenseStatus } from "@/lib/expense-approval";

const expenseStatuses = ["PENDING", "PAID"] as const;

const createExpenseSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  categoryName: z.string().min(1, "Category is required"),
  vendorId: z.string().optional().or(z.literal("")),
  shipmentId: z.string().optional().or(z.literal("")),
  status: z.enum(expenseStatuses),
  incurredAt: z.string().min(1, "Date is required"),
});

// Amount and category are locked after creation once the expense has been
// accrued to the ledger (every expense, immediately) -- editing a posted
// financial fact would silently desync the ledger balance, so only the
// non-financial fields and the workflow status stay editable here.
const updateExpenseSchema = z.object({
  description: z.string().min(1, "Description is required"),
  vendorId: z.string().optional().or(z.literal("")),
  shipmentId: z.string().optional().or(z.literal("")),
  status: z.enum(expenseStatuses),
  incurredAt: z.string().min(1, "Date is required"),
});

const rejectExpenseSchema = z.object({
  reason: z.string().min(1, "A reason is required"),
});

export async function createExpenseAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const user = await requireUser();
  const parsed = createExpenseSchema.safeParse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    categoryName: formData.get("categoryName"),
    vendorId: formData.get("vendorId"),
    shipmentId: formData.get("shipmentId"),
    status: formData.get("status"),
    incurredAt: formData.get("incurredAt"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const status = decideExpenseStatus(parsed.data.amount, parsed.data.status);

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
        incurredAt: new Date(parsed.data.incurredAt),
        paidAt: status === "PAID" ? new Date() : null,
      },
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
  redirect(`/expenses/${expense.id}`);
}

export async function updateExpenseAction(
  id: string,
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const user = await requireUser();
  const parsed = updateExpenseSchema.safeParse({
    description: formData.get("description"),
    vendorId: formData.get("vendorId"),
    shipmentId: formData.get("shipmentId"),
    status: formData.get("status"),
    incurredAt: formData.get("incurredAt"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const existing = await prisma.expense.findUniqueOrThrow({ where: { id } });

  // Once an expense has left PENDING (queued for approval or already
  // paid), status only changes through the dedicated approve/reject/pay
  // actions below -- this form can't be used to skip the approval queue.
  const nextStatus =
    existing.status === "PENDING"
      ? decideExpenseStatus(Number(existing.amount), parsed.data.status)
      : existing.status;

  if (nextStatus !== existing.status) {
    assertCanTransitionExpenseStatus(existing.status, nextStatus);
  }

  await prisma.$transaction(async (tx) => {
    await tx.expense.update({
      where: { id },
      data: {
        description: parsed.data.description,
        vendorId: parsed.data.vendorId || null,
        shipmentId: parsed.data.shipmentId || null,
        status: nextStatus,
        incurredAt: new Date(parsed.data.incurredAt),
        paidAt: nextStatus === "PAID" ? (existing.paidAt ?? new Date()) : existing.paidAt,
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

  await prisma.expense.update({
    where: { id },
    data: { status: "APPROVED", approvedById: admin.id, approvedAt: new Date(), rejectedReason: null },
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

  const expense = await prisma.expense.findUniqueOrThrow({ where: { id } });
  assertCanTransitionExpenseStatus(expense.status, "REJECTED");

  await prisma.expense.update({
    where: { id },
    data: {
      status: "REJECTED",
      approvedById: admin.id,
      approvedAt: new Date(),
      rejectedReason: parsed.data.reason,
    },
  });

  revalidatePath(`/expenses/${id}`);
  revalidatePath("/expenses");
  return { error: null };
}

export async function payExpenseAction(id: string) {
  const user = await requireUser();
  const expense = await prisma.expense.findUniqueOrThrow({ where: { id } });
  assertCanTransitionExpenseStatus(expense.status, "PAID");

  await prisma.$transaction(async (tx) => {
    await tx.expense.update({ where: { id }, data: { status: "PAID", paidAt: new Date() } });
    await payoutExpense(tx, id, user.id);
  });

  revalidatePath(`/expenses/${id}`);
  revalidatePath("/expenses");
}
