"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { SERVICE_TYPES } from "@/lib/services";

const quoteStatuses = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"] as const;
const shipmentTypes = ["IMPORT", "EXPORT", "TRANSSHIPMENT", "DOMESTIC", "CUSTOMS_CLEARANCE"] as const;

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
  serviceType: z.enum(SERVICE_TYPES),
  purchaseRequestId: z.string().optional().or(z.literal("")),
});

const quoteSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  type: z.enum(shipmentTypes),
  shipmentId: z.string().optional().or(z.literal("")),
  expiryDate: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  items: z.array(lineItemSchema).min(1, "Add at least one line item"),
});

// nextval() on a Postgres sequence is atomic, so concurrent quote
// creation can never collide on the same number.
async function generateQuoteNumber() {
  const year = new Date().getFullYear();
  const [{ nextval }] = await prisma.$queryRaw<{ nextval: bigint }[]>`
    SELECT nextval('quote_number_seq') AS nextval
  `;
  return `QT-${year}-${String(nextval).padStart(4, "0")}`;
}

export async function createQuoteAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  await requireUser();

  const descriptions = formData.getAll("description[]") as string[];
  const quantities = formData.getAll("quantity[]") as string[];
  const unitPrices = formData.getAll("unitPrice[]") as string[];
  const serviceTypes = formData.getAll("serviceType[]") as string[];
  const purchaseRequestIds = formData.getAll("purchaseRequestId[]") as string[];

  const items = descriptions
    .map((description, i) => ({
      description,
      quantity: quantities[i],
      unitPrice: unitPrices[i],
      serviceType: serviceTypes[i],
      purchaseRequestId: purchaseRequestIds[i],
    }))
    .filter((item) => item.description.trim() !== "");

  const parsed = quoteSchema.safeParse({
    clientId: formData.get("clientId"),
    type: formData.get("type"),
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
      type: parsed.data.type,
      shipmentId: parsed.data.shipmentId || null,
      expiryDate: parsed.data.expiryDate ? new Date(parsed.data.expiryDate) : null,
      notes: parsed.data.notes || null,
      items: {
        create: parsed.data.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          serviceType: item.serviceType,
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
  const [{ nextval }] = await prisma.$queryRaw<{ nextval: bigint }[]>`
    SELECT nextval('invoice_number_seq') AS nextval
  `;
  return `INV-${year}-${String(nextval).padStart(4, "0")}`;
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
          serviceType: item.serviceType,
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
