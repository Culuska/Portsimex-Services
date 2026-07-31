"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const expenseStatuses = ["PENDING", "PAID"] as const;

const expenseSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  categoryName: z.string().min(1, "Category is required"),
  vendorId: z.string().optional().or(z.literal("")),
  shipmentId: z.string().optional().or(z.literal("")),
  status: z.enum(expenseStatuses),
  incurredAt: z.string().min(1, "Date is required"),
});

function parseExpenseForm(formData: FormData) {
  return expenseSchema.safeParse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    categoryName: formData.get("categoryName"),
    vendorId: formData.get("vendorId"),
    shipmentId: formData.get("shipmentId"),
    status: formData.get("status"),
    incurredAt: formData.get("incurredAt"),
  });
}

export async function createExpenseAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  await requireUser();
  const parsed = parseExpenseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const category = await prisma.expenseCategory.upsert({
    where: { name: parsed.data.categoryName.trim() },
    update: {},
    create: { name: parsed.data.categoryName.trim() },
  });

  const expense = await prisma.expense.create({
    data: {
      description: parsed.data.description,
      amount: parsed.data.amount,
      categoryId: category.id,
      vendorId: parsed.data.vendorId || null,
      shipmentId: parsed.data.shipmentId || null,
      status: parsed.data.status,
      incurredAt: new Date(parsed.data.incurredAt),
      paidAt: parsed.data.status === "PAID" ? new Date() : null,
    },
  });

  revalidatePath("/expenses");
  redirect(`/expenses/${expense.id}`);
}

export async function updateExpenseAction(
  id: string,
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  await requireUser();
  const parsed = parseExpenseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const category = await prisma.expenseCategory.upsert({
    where: { name: parsed.data.categoryName.trim() },
    update: {},
    create: { name: parsed.data.categoryName.trim() },
  });

  const existing = await prisma.expense.findUniqueOrThrow({ where: { id } });

  await prisma.expense.update({
    where: { id },
    data: {
      description: parsed.data.description,
      amount: parsed.data.amount,
      categoryId: category.id,
      vendorId: parsed.data.vendorId || null,
      shipmentId: parsed.data.shipmentId || null,
      status: parsed.data.status,
      incurredAt: new Date(parsed.data.incurredAt),
      paidAt:
        parsed.data.status === "PAID"
          ? (existing.paidAt ?? new Date())
          : null,
    },
  });

  revalidatePath("/expenses");
  revalidatePath(`/expenses/${id}`);
  return { error: null };
}
