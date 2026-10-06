"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { recognizeInvoiceRevenue, recordInvoicePaymentCash } from "@/lib/ledger";
import { nextInvoiceNumber } from "@/lib/numbering";
import { audit } from "@/lib/audit";

const invoiceStatuses = [
  "DRAFT",
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED",
] as const;

const paymentMethods = [
  "BANK_TRANSFER",
  "CASH",
  "CHECK",
  "CARD",
  "MOBILE_MONEY",
  "OTHER",
] as const;

const lineItemSchema = z.object({
  jobId: z.string(),
  description: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
});

const invoiceSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  shipmentId: z.string().optional().or(z.literal("")),
  dueDate: z.string().min(1, "Due date is required"),
  notes: z.string().optional().or(z.literal("")),
  items: z.array(lineItemSchema).min(1, "Add at least one line item"),
});

function generateInvoiceNumber() {
  return nextInvoiceNumber(prisma);
}

export async function createInvoiceAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  await requireStaff();

  const descriptions = formData.getAll("description[]") as string[];
  const quantities = formData.getAll("quantity[]") as string[];
  const unitPrices = formData.getAll("unitPrice[]") as string[];
  const jobIds = formData.getAll("jobId[]") as string[];

  const items = descriptions
    .map((description, i) => ({
      jobId: jobIds[i] ?? "",
      description,
      quantity: quantities[i],
      unitPrice: unitPrices[i],
    }))
    .filter((item) => item.description.trim() !== "");

  const parsed = invoiceSchema.safeParse({
    clientId: formData.get("clientId"),
    shipmentId: formData.get("shipmentId"),
    dueDate: formData.get("dueDate"),
    notes: formData.get("notes"),
    items,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Each line's job must belong to the invoiced client.
  const lineJobIds = [...new Set(parsed.data.items.map((i) => i.jobId).filter(Boolean))];
  if (lineJobIds.length > 0) {
    const owned = await prisma.job.count({ where: { id: { in: lineJobIds }, clientId: parsed.data.clientId } });
    if (owned !== lineJobIds.length) return { error: "A line is linked to a job for a different client." };
  }

  const invoiceNumber = await generateInvoiceNumber();

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      clientId: parsed.data.clientId,
      shipmentId: parsed.data.shipmentId || null,
      dueDate: new Date(parsed.data.dueDate),
      notes: parsed.data.notes || null,
      items: {
        create: parsed.data.items.map((item) => ({
          jobId: item.jobId || null,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      },
    },
  });

  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}

const statusSchema = z.object({ status: z.enum(invoiceStatuses) });

export async function updateInvoiceStatusAction(id: string, formData: FormData) {
  const user = await requireStaff();
  const parsed = statusSchema.safeParse({ status: formData.get("status") });
  if (!parsed.success) return;

  await prisma.$transaction(async (tx) => {
    const before = await tx.invoice.findUniqueOrThrow({ where: { id } });
    await tx.invoice.update({
      where: { id },
      data: { status: parsed.data.status },
    });
    if (before.status !== parsed.data.status) {
      await audit(tx, user, {
        action: `INVOICE_${parsed.data.status}`,
        module: "Billing",
        entityType: "Invoice",
        entityId: id,
        reference: before.invoiceNumber,
        message: `Invoice ${before.invoiceNumber} moved from ${before.status} to ${parsed.data.status}.`,
      });
    }

    // Revenue is recognized the moment the invoice is actually issued to
    // the client, not when cash arrives -- Dr Accounts Receivable / Cr
    // Freight Revenue. Idempotent, so re-saving SENT is harmless.
    if (parsed.data.status === "SENT") {
      await recognizeInvoiceRevenue(tx, id, user.id);
    }
  });

  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
}

const paymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  method: z.enum(paymentMethods),
  reference: z.string().optional().or(z.literal("")),
  paidAt: z.string().min(1),
});

export async function addPaymentAction(
  id: string,
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const user = await requireStaff();
  const parsed = paymentSchema.safeParse({
    amount: formData.get("amount"),
    method: formData.get("method"),
    reference: formData.get("reference"),
    paidAt: formData.get("paidAt"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        invoiceId: id,
        amount: parsed.data.amount,
        method: parsed.data.method,
        reference: parsed.data.reference || null,
        paidAt: new Date(parsed.data.paidAt),
      },
    });

    // Invoice Paid workflow: Dr Cash / Cr Accounts Receivable.
    await recordInvoicePaymentCash(tx, payment.id, user.id);
    const inv = await tx.invoice.findUniqueOrThrow({ where: { id }, include: { client: true } });
    await audit(tx, user, {
      action: "PAYMENT_RECORDED",
      module: "Billing",
      entityType: "Invoice",
      entityId: id,
      reference: inv.invoiceNumber,
      message: `Recorded client payment of ${parsed.data.amount.toFixed(2)} (${parsed.data.method.replace(/_/g, " ").toLowerCase()}) from ${inv.client.name} against ${inv.invoiceNumber}.`,
    });
  });

  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id },
    include: { items: true, payments: true },
  });
  const total = invoice.items.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
    0,
  );
  const paid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);

  if (invoice.status !== "CANCELLED") {
    await prisma.invoice.update({
      where: { id },
      data: { status: paid >= total ? "PAID" : "PARTIALLY_PAID" },
    });
  }

  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  return { error: null };
}

export async function deleteDraftInvoiceAction(id: string) {
  await requireStaff();
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice || invoice.status !== "DRAFT") {
    return;
  }
  await prisma.invoice.delete({ where: { id } });
  revalidatePath("/invoices");
  redirect("/invoices");
}
