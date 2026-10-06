import { describe, expect, it } from "vitest";
import { computeJobFinancials, summarize } from "./job-finance";

describe("computeJobFinancials", () => {
  it("tax exemption example: revenue 300, direct cost 120, profit 180", () => {
    const f = computeJobFinancials(
      [
        { amount: 100, status: "PAID", billingType: "NON_BILLABLE", markupAmount: 0, billedOnInvoiceStatus: null },
        { amount: 20, status: "PAID", billingType: "NON_BILLABLE", markupAmount: 0, billedOnInvoiceStatus: null },
      ],
      [{ amount: 300, invoiceId: "i1", invoiceStatus: "PAID", invoiceTotal: 300, invoicePaid: 300 }],
    );
    expect(f).toMatchObject({ invoiced: 300, costs: 120, grossProfit: 180, marginPercent: 60, paid: 300, outstanding: 0 });
  });

  it("separates billable pass-through costs, markup and unbilled amounts", () => {
    const f = computeJobFinancials(
      [
        { amount: 100, status: "APPROVED", billingType: "BILLABLE_WITH_MARKUP", markupAmount: 30, billedOnInvoiceStatus: null },
        { amount: 40, status: "PAID", billingType: "BILLABLE", markupAmount: 0, billedOnInvoiceStatus: "SENT" },
        { amount: 10, status: "REJECTED", billingType: "BILLABLE", markupAmount: 0, billedOnInvoiceStatus: null },
      ],
      [{ amount: 40, invoiceId: "i1", invoiceStatus: "SENT", invoiceTotal: 40, invoicePaid: 0 }],
    );
    expect(f.costs).toBe(140); // rejected cost ignored
    expect(f.billableCosts).toBe(140);
    expect(f.unbilledBillableCosts).toBe(100);
    expect(f.unbilledMarkup).toBe(30);
    expect(f.expectedRevenue).toBe(170);
    expect(f.expectedProfit).toBe(30);
  });

  it("treats costs on a cancelled invoice as unbilled again", () => {
    const f = computeJobFinancials(
      [{ amount: 50, status: "PAID", billingType: "BILLABLE", markupAmount: 0, billedOnInvoiceStatus: "CANCELLED" }],
      [],
    );
    expect(f.unbilledBillableCosts).toBe(50);
  });

  it("allocates invoice payments to the job pro rata and ignores drafts", () => {
    const f = computeJobFinancials(
      [],
      [
        // This job is 1,500 of a 3,000 invoice that is half paid.
        { amount: 1500, invoiceId: "multi", invoiceStatus: "PARTIALLY_PAID", invoiceTotal: 3000, invoicePaid: 1500 },
        { amount: 200, invoiceId: "draft", invoiceStatus: "DRAFT", invoiceTotal: 200, invoicePaid: 0 },
      ],
    );
    expect(f).toMatchObject({ invoiced: 1500, paid: 750, outstanding: 750, draftInvoiced: 200, draftLines: 1 });
  });

  it("caps overpayment at the invoice total", () => {
    const f = computeJobFinancials([], [{ amount: 100, invoiceId: "i", invoiceStatus: "PAID", invoiceTotal: 100, invoicePaid: 120 }]);
    expect(f.paid).toBe(100);
    expect(f.outstanding).toBe(0);
  });
});

describe("summarize", () => {
  it("client profitability example: 93,000 revenue, 60,000 cost, 35.5% margin", () => {
    expect(summarize([{ invoiced: 93000, costs: 60000 }])).toEqual({ revenue: 93000, costs: 60000, grossProfit: 33000, marginPercent: 35.5 });
  });
});
