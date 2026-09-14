"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const quoteStatuses = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"] as const;

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
  purchaseRequestId: z.string().optional().or(z.literal("")),
});

const quoteSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  shipmentId: z.string().optional().or(z.literal("")),
  expiryDate: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  items: z.array(lineItemSchema).min(1, "Add at least one line item"),
});

async function generateQuoteNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.quote.count();
  return `QT-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function createQuoteAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  await requireUser();

  const descriptions = formData.getAll("description[]") as string[];
  const quantities = formData.getAll("quantity[]") as string[];
  const unitPrices = formData.getAll("unitPrice[]") as string[];
  const purchaseRequestIds = formData.getAll("purchaseRequestId[]") as string[];

  const items = descriptions
    .map((description, i) => ({
      description,
      quantity: quantities[i],
      unitPrice: unitPrices[i],
      purchaseRequestId: purchaseRequestIds[i],
    }))
    .filter((item) => item.description.trim() !== "");

  const parsed = quoteSchema.safeParse({
    clientId: formData.get("clientId"),
    shipmentId: formData.get("shipmentId"),
    expiryDate: formData.get("expiryDate"),
    notes: formData.get("notes"),
    items,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const quoteNumber = await generateQuoteNumber();

  const quote = await prisma.quote.create({
    data: {
      quoteNumber,
      clientId: parsed.data.clientId,
      shipmentId: parsed.data.shipmentId || null,
      expiryDate: parsed.data.expiryDate ? new Date(parsed.data.expiryDate) : null,
      notes: parsed.data.notes || null,
      items: {
        create: parsed.data.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          purchaseRequestId: item.purchaseRequestId || null,
        })),
      },
    },
  });

  revalidatePath("/quotes");
  redirect(`/quotes/${quote.id}`);
}

const statusSchema = z.object({ status: z.enum(quoteStatuses) });

export async function updateQuoteStatusAction(id: string, formData: FormData) {
  await requireUser();
  const parsed = statusSchema.safeParse({ status: formData.get("status") });
  if (!parsed.success) return;

  await prisma.quote.update({
    where: { id },
    data: { status: parsed.data.status },
  });

  revalidatePath(`/quotes/${id}`);
  revalidatePath("/quotes");
}

async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.invoice.count();
  return `INV-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function convertQuoteToInvoiceAction(id: string) {
  await requireUser();

  const quote = await prisma.quote.findUniqueOrThrow({
    where: { id },
    include: { items: true, invoice: true },
  });

  if (quote.status !== "ACCEPTED" || quote.invoice) return;

  const invoiceNumber = await generateInvoiceNumber();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      clientId: quote.clientId,
      shipmentId: quote.shipmentId,
      quoteId: quote.id,
      dueDate,
      notes: quote.notes,
      items: {
        create: quote.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      },
    },
  });

  revalidatePath(`/quotes/${id}`);
  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}

export async function deleteDraftQuoteAction(id: string) {
  await requireUser();
  const quote = await prisma.quote.findUnique({ where: { id } });
  if (!quote || quote.status !== "DRAFT") {
    return;
  }
  await prisma.quote.delete({ where: { id } });
  revalidatePath("/quotes");
  redirect("/quotes");
}
