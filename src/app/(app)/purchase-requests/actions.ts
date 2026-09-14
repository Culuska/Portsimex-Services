"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/session";

const purchaseRequestSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  categoryName: z.string().min(1, "Category is required"),
  vendorId: z.string().optional().or(z.literal("")),
  shipmentId: z.string().optional().or(z.literal("")),
  clientId: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

async function generateRequestNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.purchaseRequest.count();
  return `PR-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function createPurchaseRequestAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const user = await requireUser();
  const parsed = purchaseRequestSchema.safeParse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    categoryName: formData.get("categoryName"),
    vendorId: formData.get("vendorId"),
    shipmentId: formData.get("shipmentId"),
    clientId: formData.get("clientId"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const category = await prisma.expenseCategory.upsert({
    where: { name: parsed.data.categoryName.trim() },
    update: {},
    create: { name: parsed.data.categoryName.trim() },
  });

  const requestNumber = await generateRequestNumber();

  const pr = await prisma.purchaseRequest.create({
    data: {
      requestNumber,
      description: parsed.data.description,
      amount: parsed.data.amount,
      categoryId: category.id,
      vendorId: parsed.data.vendorId || null,
      shipmentId: parsed.data.shipmentId || null,
      clientId: parsed.data.clientId || null,
      notes: parsed.data.notes || null,
      requestedById: user.id,
    },
  });

  revalidatePath("/purchase-requests");
  redirect(`/purchase-requests/${pr.id}`);
}

export async function approvePurchaseRequestAction(id: string) {
  const admin = await requireAdmin();

  const pr = await prisma.purchaseRequest.findUniqueOrThrow({ where: { id } });
  if (pr.status !== "PENDING") return;

  const expense = await prisma.expense.create({
    data: {
      description: pr.description,
      amount: pr.amount,
      categoryId: pr.categoryId,
      vendorId: pr.vendorId,
      shipmentId: pr.shipmentId,
      status: "PENDING",
      incurredAt: new Date(),
    },
  });

  await prisma.purchaseRequest.update({
    where: { id },
    data: {
      status: "APPROVED",
      decidedById: admin.id,
      decidedAt: new Date(),
      expenseId: expense.id,
    },
  });

  revalidatePath("/purchase-requests");
  revalidatePath(`/purchase-requests/${id}`);
  revalidatePath("/expenses");
}

export async function rejectPurchaseRequestAction(id: string) {
  const admin = await requireAdmin();

  const pr = await prisma.purchaseRequest.findUniqueOrThrow({ where: { id } });
  if (pr.status !== "PENDING") return;

  await prisma.purchaseRequest.update({
    where: { id },
    data: {
      status: "REJECTED",
      decidedById: admin.id,
      decidedAt: new Date(),
    },
  });

  revalidatePath("/purchase-requests");
  revalidatePath(`/purchase-requests/${id}`);
}
