// Job/Case financials, kept deliberately separate:
//   what the company spent (costs), what can be billed (billable costs +
//   markup), what was invoiced, what the client paid, what is outstanding,
//   and the resulting gross profit.
// Pure module (no app imports) so the numbers are unit tested.

export type BillingType = "NON_BILLABLE" | "BILLABLE" | "BILLABLE_WITH_MARKUP";
export type InvoiceStatus = "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED";

export type JobExpenseInput = {
  amount: number;
  status: string;
  billingType: BillingType;
  markupAmount: number;
  /** Status of the invoice this cost was re-charged on, if any. */
  billedOnInvoiceStatus: InvoiceStatus | null;
};

export type JobInvoiceLineInput = {
  amount: number;
  invoiceId: string;
  invoiceStatus: InvoiceStatus;
  /** Whole-invoice total and payments, used to allocate payments to this job's lines pro rata. */
  invoiceTotal: number;
  invoicePaid: number;
};

export type JobFinancials = {
  costs: number;
  billableCosts: number;
  nonBillableCosts: number;
  plannedMarkup: number;
  unbilledBillableCosts: number;
  unbilledMarkup: number;
  invoiced: number;
  draftInvoiced: number;
  draftLines: number;
  paid: number;
  outstanding: number;
  grossProfit: number;
  marginPercent: number | null;
  /** Invoiced + drafts + still-unbilled recharges: where revenue lands if everything is billed. */
  expectedRevenue: number;
  expectedProfit: number;
};

const ISSUED: InvoiceStatus[] = ["SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"];
const round = (n: number) => Math.round(n * 100) / 100;

export function isIssued(status: InvoiceStatus) {
  return ISSUED.includes(status);
}

/** A cost counts as billed only while it sits on a live (non-cancelled) invoice. */
export function isExpenseBilled(billedOnInvoiceStatus: InvoiceStatus | null) {
  return billedOnInvoiceStatus !== null && billedOnInvoiceStatus !== "CANCELLED";
}

export function computeJobFinancials(expenses: JobExpenseInput[], lines: JobInvoiceLineInput[]): JobFinancials {
  const live = expenses.filter((e) => e.status !== "REJECTED");
  const costs = live.reduce((s, e) => s + e.amount, 0);
  const billable = live.filter((e) => e.billingType !== "NON_BILLABLE");
  const billableCosts = billable.reduce((s, e) => s + e.amount, 0);
  const plannedMarkup = billable.reduce((s, e) => s + (e.billingType === "BILLABLE_WITH_MARKUP" ? e.markupAmount : 0), 0);
  const unbilled = billable.filter((e) => !isExpenseBilled(e.billedOnInvoiceStatus));
  const unbilledBillableCosts = unbilled.reduce((s, e) => s + e.amount, 0);
  const unbilledMarkup = unbilled.reduce((s, e) => s + (e.billingType === "BILLABLE_WITH_MARKUP" ? e.markupAmount : 0), 0);

  const issued = lines.filter((l) => isIssued(l.invoiceStatus));
  const drafts = lines.filter((l) => l.invoiceStatus === "DRAFT");
  const invoiced = issued.reduce((s, l) => s + l.amount, 0);
  const draftInvoiced = drafts.reduce((s, l) => s + l.amount, 0);

  // Payments are recorded per invoice; allocate them to this job pro rata
  // to its share of each invoice's total.
  const byInvoice = new Map<string, { jobAmount: number; total: number; paid: number }>();
  for (const l of issued) {
    const entry = byInvoice.get(l.invoiceId) ?? { jobAmount: 0, total: l.invoiceTotal, paid: l.invoicePaid };
    entry.jobAmount += l.amount;
    byInvoice.set(l.invoiceId, entry);
  }
  let paid = 0;
  for (const { jobAmount, total, paid: invPaid } of byInvoice.values()) {
    if (total > 0) paid += (Math.min(invPaid, total) * jobAmount) / total;
  }

  const grossProfit = invoiced - costs;
  const expectedRevenue = invoiced + draftInvoiced + unbilledBillableCosts + unbilledMarkup;
  return {
    costs: round(costs),
    billableCosts: round(billableCosts),
    nonBillableCosts: round(costs - billableCosts),
    plannedMarkup: round(plannedMarkup),
    unbilledBillableCosts: round(unbilledBillableCosts),
    unbilledMarkup: round(unbilledMarkup),
    invoiced: round(invoiced),
    draftInvoiced: round(draftInvoiced),
    draftLines: drafts.length,
    paid: round(paid),
    outstanding: round(invoiced - paid),
    grossProfit: round(grossProfit),
    marginPercent: invoiced > 0 ? Math.round((grossProfit / invoiced) * 1000) / 10 : null,
    expectedRevenue: round(expectedRevenue),
    expectedProfit: round(expectedRevenue - costs),
  };
}

export type ProfitRow = { revenue: number; costs: number; grossProfit: number; marginPercent: number | null };

export function summarize(rows: { invoiced: number; costs: number }[]): ProfitRow {
  const revenue = rows.reduce((s, r) => s + r.invoiced, 0);
  const costs = rows.reduce((s, r) => s + r.costs, 0);
  const grossProfit = revenue - costs;
  return {
    revenue: round(revenue),
    costs: round(costs),
    grossProfit: round(grossProfit),
    marginPercent: revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : null,
  };
}
