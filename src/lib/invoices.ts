type ItemLike = { quantity: unknown; unitPrice: unknown };
type InvoiceItemLike = ItemLike & { sourceExpenseId?: string | null };
type PaymentLike = { amount: unknown };
type InvoiceLike = { items: InvoiceItemLike[]; discountAmount?: unknown; taxRate?: unknown };

const round = (n: number) => Math.round(n * 100) / 100 || 0;

/** Sum of line amounts (quotes, and an invoice before discount and tax). */
export function invoiceTotal(items: ItemLike[]): number {
  return items.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
    0,
  );
}

export type InvoiceTotals = {
  subtotal: number;
  /** Lines re-charging a cost at cost (disbursements): never discounted or taxed. */
  recharged: number;
  serviceSubtotal: number;
  discount: number;
  taxRate: number;
  taxable: number;
  tax: number;
  total: number;
};

// Discount comes off the service fees; tax is charged on the service fees
// after discount. Costs paid on the client's behalf and re-charged at cost
// are disbursements, so they pass through untouched.
export function invoiceTotals(invoice: InvoiceLike): InvoiceTotals {
  const lineAmount = (i: ItemLike) => Number(i.quantity) * Number(i.unitPrice);
  const subtotal = round(invoice.items.reduce((s, i) => s + lineAmount(i), 0));
  const recharged = round(invoice.items.filter((i) => i.sourceExpenseId).reduce((s, i) => s + lineAmount(i), 0));
  const serviceSubtotal = round(subtotal - recharged);
  const discount = round(Math.min(Math.max(Number(invoice.discountAmount ?? 0), 0), Math.max(serviceSubtotal, 0)));
  const taxRate = Math.max(Number(invoice.taxRate ?? 0), 0);
  const taxable = round(serviceSubtotal - discount);
  const tax = round((taxable * taxRate) / 100);
  return { subtotal, recharged, serviceSubtotal, discount, taxRate, taxable, tax, total: round(subtotal - discount + tax) };
}

/** What the client owes in full: lines - discount + tax. */
export function invoiceGrandTotal(invoice: InvoiceLike): number {
  return invoiceTotals(invoice).total;
}

/** A line's share of the invoice's revenue, net of its share of the discount (tax excluded). */
export function netLineAmount(item: InvoiceItemLike, invoice: InvoiceLike): number {
  const amount = Number(item.quantity) * Number(item.unitPrice);
  if (item.sourceExpenseId) return amount;
  const t = invoiceTotals(invoice);
  if (t.serviceSubtotal <= 0 || t.discount <= 0) return amount;
  return round(amount * (1 - t.discount / t.serviceSubtotal));
}

export function invoicePaid(payments: PaymentLike[]): number {
  return payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
}

export function invoiceBalance(invoice: InvoiceLike & { payments: PaymentLike[] }): number {
  return round(invoiceGrandTotal(invoice) - invoicePaid(invoice.payments));
}

/** What the invoice earns the company: lines less discount, tax excluded (tax is owed to the authority). */
export function invoiceNetOfTax(invoice: InvoiceLike): number {
  const t = invoiceTotals(invoice);
  return round(t.subtotal - t.discount);
}
