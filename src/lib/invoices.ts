type ItemLike = { quantity: unknown; unitPrice: unknown };
type PaymentLike = { amount: unknown };

export function invoiceTotal(items: ItemLike[]): number {
  return items.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
    0,
  );
}

export function invoicePaid(payments: PaymentLike[]): number {
  return payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
}

export function invoiceBalance(items: ItemLike[], payments: PaymentLike[]): number {
  return invoiceTotal(items) - invoicePaid(payments);
}
