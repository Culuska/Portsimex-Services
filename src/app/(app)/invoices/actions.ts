"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { recognizeInvoiceRevenue, recordAdvanceReceipt, recordInvoicePaymentCash, reverseInvoiceRevenue } from "@/lib/ledger";
import { nextFinanceNumber, nextInvoiceNumber } from "@/lib/numbering";
import { invoiceBalance, invoiceGrandTotal, invoiceTotals } from "@/lib/invoices";
import { businessDate, checkAdvanceApplication, FinanceRuleError, splitPayment } from "@/lib/finance-rules";
import { advanceRemaining, syncInvoiceStatus } from "@/lib/finance";
import { audit } from "@/lib/audit";

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
  discountAmount: z.coerce.number().min(0, "The discount can't be negative"),
  taxRate: z.coerce.number().min(0, "The tax rate can't be negative").max(100, "The tax rate is a percentage (0-100)"),
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
    discountAmount: formData.get("discountAmount") || 0,
    taxRate: formData.get("taxRate") || 0,
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

  const lineTotal = parsed.data.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  if (parsed.data.discountAmount > lineTotal + 0.005) return { error: "The discount can't be more than the invoice lines." };

  const invoiceNumber = await generateInvoiceNumber();

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      clientId: parsed.data.clientId,
      shipmentId: parsed.data.shipmentId || null,
      dueDate: new Date(parsed.data.dueDate),
      notes: parsed.data.notes || null,
      discountAmount: parsed.data.discountAmount,
      taxRate: parsed.data.taxRate,
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

type State = { error: string | null };
const ok: State = { error: null };

function refreshInvoice(id: string) {
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  revalidatePath("/finance");
}

// Issuing an invoice is the accounting event: revenue is recognized the
// moment it goes to the client, not when cash arrives (Dr Accounts
// Receivable / Cr Service Revenue, Disbursements, Tax Payable).
export async function issueInvoiceAction(id: string): Promise<void> {
  const user = await requireStaff();
  await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.findUniqueOrThrow({ where: { id }, include: { items: true } });
    if (inv.status !== "DRAFT") return;
    if (inv.items.length === 0) throw new Error("An invoice needs at least one line before it can be issued.");
    await tx.invoice.update({ where: { id }, data: { status: "SENT", issueDate: new Date() } });
    await recognizeInvoiceRevenue(tx, id, user.id);
    await audit(tx, user, {
      action: "INVOICE_SENT",
      module: "Billing",
      entityType: "Invoice",
      entityId: id,
      reference: inv.invoiceNumber,
      message: `Issued invoice ${inv.invoiceNumber} for ${invoiceGrandTotal(inv).toFixed(2)}.`,
    });
  });
  refreshInvoice(id);
}

// Cancelling reverses the revenue entry. Anything already paid must be
// dealt with first (refunded, or moved to client credit) so money is never
// silently dropped.
export async function cancelInvoiceAction(id: string, _prev: State, formData: FormData): Promise<State> {
  const user = await requireStaff();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Give a reason for cancelling the invoice." };
  const inv = await prisma.invoice.findUniqueOrThrow({ where: { id }, include: { payments: true } });
  if (inv.status === "CANCELLED") return ok;
  if (inv.payments.length > 0) {
    return { error: "This invoice has payments recorded against it -- it can't be cancelled. Issue a credit by recording the correction with your accountant instead." };
  }
  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason } });
    await reverseInvoiceRevenue(tx, id, user.id);
    await audit(tx, user, {
      action: "INVOICE_CANCELLED",
      module: "Billing",
      entityType: "Invoice",
      entityId: id,
      reference: inv.invoiceNumber,
      message: `Cancelled invoice ${inv.invoiceNumber}: ${reason}`,
    });
  });
  refreshInvoice(id);
  return ok;
}

const adjustmentsSchema = z.object({
  discountAmount: z.coerce.number().min(0, "The discount can't be negative"),
  taxRate: z.coerce.number().min(0, "The tax rate can't be negative").max(100, "The tax rate is a percentage (0-100)"),
});

// Discount and tax can only change while the invoice is a draft -- once
// issued, the amounts are in the ledger.
export async function updateInvoiceAdjustmentsAction(id: string, _prev: State, formData: FormData): Promise<State> {
  const user = await requireStaff();
  const parsed = adjustmentsSchema.safeParse({ discountAmount: formData.get("discountAmount") || 0, taxRate: formData.get("taxRate") || 0 });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const inv = await prisma.invoice.findUniqueOrThrow({ where: { id }, include: { items: true } });
  if (inv.status !== "DRAFT") return { error: "Discount and tax can only be changed on a draft invoice." };
  const t = invoiceTotals({ ...inv, discountAmount: 0, taxRate: 0 });
  if (parsed.data.discountAmount > t.serviceSubtotal + 0.005) {
    return { error: `The discount can't exceed the service fees (${t.serviceSubtotal.toFixed(2)}); re-charged costs aren't discounted.` };
  }
  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id }, data: parsed.data });
    await audit(tx, user, {
      action: "INVOICE_ADJUSTED",
      module: "Billing",
      entityType: "Invoice",
      entityId: id,
      reference: inv.invoiceNumber,
      message: `Set discount ${parsed.data.discountAmount.toFixed(2)} and tax ${parsed.data.taxRate}% on ${inv.invoiceNumber}.`,
    });
  });
  refreshInvoice(id);
  return ok;
}

const paymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  method: z.enum(paymentMethods),
  reference: z.string().optional().or(z.literal("")),
  paidAt: z.string().min(1),
  moneyAccountId: z.string().optional().or(z.literal("")),
});

// A client payment: settles the invoice balance (Dr Cash/Bank / Cr
// Accounts Receivable); anything paid over the balance is kept as client
// credit (Dr Cash/Bank / Cr Client Advances) to use on a later invoice or
// refund -- the invoice never goes below zero.
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
    moneyAccountId: formData.get("moneyAccountId") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id }, include: { items: true, payments: true, client: true } });
  if (invoice.status === "CANCELLED") return { error: "This invoice is cancelled." };
  const { applied, excess } = splitPayment(d.amount, invoiceBalance(invoice));
  const paidAt = businessDate(d.paidAt);

  await prisma.$transaction(async (tx) => {
    if (applied > 0) {
      const payment = await tx.payment.create({
        data: {
          invoiceId: id,
          amount: applied,
          method: d.method,
          reference: d.reference || null,
          paidAt,
          moneyAccountId: d.moneyAccountId || null,
        },
      });
      await recordInvoicePaymentCash(tx, payment.id, user.id);
    }
    let creditNumber: string | null = null;
    if (excess > 0) {
      const credit = await tx.clientAdvance.create({
        data: {
          advanceNumber: await nextFinanceNumber(tx, "ADV"),
          clientId: invoice.clientId,
          amount: excess,
          receivedAt: paidAt,
          method: d.method,
          reference: d.reference || null,
          source: "OVERPAYMENT",
          sourceInvoiceId: id,
          moneyAccountId: d.moneyAccountId || null,
          notes: `Overpayment on invoice ${invoice.invoiceNumber}`,
        },
      });
      await recordAdvanceReceipt(tx, credit.id, user.id);
      creditNumber = credit.advanceNumber;
    }
    await syncInvoiceStatus(tx, id);
    await audit(tx, user, {
      action: "PAYMENT_RECORDED",
      module: "Billing",
      entityType: "Invoice",
      entityId: id,
      reference: invoice.invoiceNumber,
      message: `Recorded client payment of ${d.amount.toFixed(2)} (${d.method.replace(/_/g, " ").toLowerCase()}) from ${invoice.client.name} against ${invoice.invoiceNumber}${creditNumber ? `; ${excess.toFixed(2)} over the balance kept as client credit ${creditNumber}` : ""}.`,
    });
  });

  refreshInvoice(id);
  revalidatePath("/finance/advances");
  return { error: null };
}

// Settles (part of) an invoice from the client's advance / credit balance:
// Dr Client Advances / Cr Accounts Receivable. No new money moves.
export async function applyAdvanceAction(id: string, _prev: State, formData: FormData): Promise<State> {
  const user = await requireStaff();
  const advanceId = String(formData.get("advanceId") ?? "");
  const amount = Number(formData.get("amount"));
  if (!advanceId) return { error: "Choose the advance to use." };
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id }, include: { items: true, payments: true } });
  if (invoice.status === "CANCELLED") return { error: "This invoice is cancelled." };
  const advance = await prisma.clientAdvance.findUniqueOrThrow({ where: { id: advanceId } });
  if (advance.clientId !== invoice.clientId) return { error: "That advance belongs to a different client." };

  try {
    await prisma.$transaction(async (tx) => {
      const { remaining } = await advanceRemaining(tx, advanceId);
      const problem = checkAdvanceApplication(amount, remaining, invoiceBalance(invoice));
      if (problem) throw new FinanceRuleError(problem);
      const payment = await tx.payment.create({
        data: { invoiceId: id, amount, method: "ADVANCE", advanceId, reference: advance.advanceNumber, paidAt: new Date() },
      });
      await recordInvoicePaymentCash(tx, payment.id, user.id);
      await syncInvoiceStatus(tx, id);
      await audit(tx, user, {
        action: "ADVANCE_APPLIED",
        module: "Billing",
        entityType: "Invoice",
        entityId: id,
        reference: invoice.invoiceNumber,
        message: `Applied ${amount.toFixed(2)} from client advance ${advance.advanceNumber} to invoice ${invoice.invoiceNumber}.`,
      });
    });
  } catch (e) {
    if (e instanceof FinanceRuleError) return { error: e.message };
    throw e;
  }
  refreshInvoice(id);
  revalidatePath(`/finance/advances/${advanceId}`);
  revalidatePath("/finance/advances");
  return ok;
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
