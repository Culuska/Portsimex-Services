import { describe, expect, it } from "vitest";
import { invoiceBalance, invoiceTotals, netLineAmount } from "./invoices";
import {
  ageItems,
  advanceBalance,
  agingBucket,
  billStatus,
  businessDate,
  buildStatement,
  checkAdvanceApplication,
  checkJournal,
  checkRefund,
  checkSupplierPayment,
  nextMoneyAccountCode,
  splitPayment,
} from "./finance-rules";
import { balanceSheet, cashFlow, monthlyPerformance, profitAndLoss, type LedgerRow } from "./statements";
import { buildXlsx, columnName, crc32, safeSheetName } from "./xlsx";

describe("invoice totals", () => {
  const invoice = {
    items: [
      { quantity: 1, unitPrice: 100, sourceExpenseId: "exp1" }, // government fee re-charged at cost
      { quantity: 1, unitPrice: 300, sourceExpenseId: null }, // service fee
      { quantity: 2, unitPrice: 50, sourceExpenseId: null },
    ],
    discountAmount: 40,
    taxRate: 10,
  };

  it("discounts and taxes service fees only, never re-charged costs", () => {
    const t = invoiceTotals(invoice);
    expect(t.subtotal).toBe(500);
    expect(t.recharged).toBe(100);
    expect(t.serviceSubtotal).toBe(400);
    expect(t.discount).toBe(40);
    expect(t.taxable).toBe(360);
    expect(t.tax).toBe(36);
    expect(t.total).toBe(496);
  });

  it("caps the discount at the service fees", () => {
    expect(invoiceTotals({ ...invoice, discountAmount: 9999 }).discount).toBe(400);
  });

  it("works for plain invoices with no discount or tax", () => {
    expect(invoiceTotals({ items: [{ quantity: 3, unitPrice: 10 }] }).total).toBe(30);
  });

  it("spreads the discount over service lines for job revenue", () => {
    expect(netLineAmount(invoice.items[0], invoice)).toBe(100);
    expect(netLineAmount(invoice.items[1], invoice)).toBe(270);
    expect(netLineAmount(invoice.items[2], invoice)).toBe(90);
  });

  it("balance is the grand total less payments", () => {
    expect(invoiceBalance({ ...invoice, payments: [{ amount: 196 }] })).toBe(300);
  });
});

describe("payments, advances and refunds", () => {
  it("keeps any overpayment as client credit", () => {
    expect(splitPayment(1200, 1000)).toEqual({ applied: 1000, excess: 200 });
    expect(splitPayment(400, 1000)).toEqual({ applied: 400, excess: 0 });
    expect(splitPayment(50, 0)).toEqual({ applied: 0, excess: 50 });
  });

  it("tracks advance received, used, refunded and remaining", () => {
    expect(advanceBalance(5000, [3000], [500])).toEqual({ amount: 5000, applied: 3000, refunded: 500, remaining: 1500 });
  });

  it("never applies more than the credit left or the invoice balance", () => {
    expect(checkAdvanceApplication(2000, 1500, 3000)).toMatch(/Only 1500.00/);
    expect(checkAdvanceApplication(1000, 1500, 800)).toMatch(/balance is only 800.00/);
    expect(checkAdvanceApplication(0, 1500, 800)).toMatch(/greater than zero/);
    expect(checkAdvanceApplication(800, 1500, 800)).toBeNull();
  });

  it("refunds only the unused part of an advance", () => {
    expect(checkRefund(600, 500)).toMatch(/Only 500.00/);
    expect(checkRefund(500, 500)).toBeNull();
  });
});

describe("supplier bills", () => {
  it("derives bill status from payments", () => {
    expect(billStatus(100, 0)).toBe("OPEN");
    expect(billStatus(100, 40)).toBe("PARTIALLY_PAID");
    expect(billStatus(100, 100)).toBe("PAID");
    expect(billStatus(100, 0, true)).toBe("CANCELLED");
  });

  it("blocks paying a bill with unapproved lines or above its balance", () => {
    expect(checkSupplierPayment(50, 100, 1)).toMatch(/approval/);
    expect(checkSupplierPayment(150, 100, 0)).toMatch(/balance is only 100.00/);
    expect(checkSupplierPayment(100, 100, 0)).toBeNull();
  });
});

describe("aging", () => {
  const now = new Date(2026, 9, 6);
  it("buckets by days past the due date", () => {
    expect(agingBucket(new Date(2026, 9, 10), now)).toBe("CURRENT");
    expect(agingBucket(new Date(2026, 9, 6), now)).toBe("CURRENT");
    expect(agingBucket(new Date(2026, 9, 5), now)).toBe("1-30");
    expect(agingBucket(new Date(2026, 7, 20), now)).toBe("31-60");
    expect(agingBucket(new Date(2026, 6, 20), now)).toBe("61-90");
    expect(agingBucket(new Date(2026, 0, 1), now)).toBe("90+");
  });

  it("groups open items per client and skips settled ones", () => {
    const a = ageItems(
      [
        { key: "c1", label: "Atlas", dueDate: new Date(2026, 9, 20), balance: 100 },
        { key: "c1", label: "Atlas", dueDate: new Date(2026, 8, 1), balance: 50 },
        { key: "c2", label: "Blue", dueDate: new Date(2026, 0, 1), balance: 0 },
      ],
      now,
    );
    expect(a.rows).toHaveLength(1);
    expect(a.rows[0].buckets.CURRENT).toBe(100);
    expect(a.rows[0].buckets["31-60"]).toBe(50);
    expect(a.total).toBe(150);
  });
});

describe("client statement", () => {
  it("lists a charge before a payment recorded at the same moment", () => {
    const at = new Date(Date.UTC(2026, 9, 6, 9, 0));
    const s = buildStatement(
      [
        { date: at, type: "Payment", reference: "", description: "", debit: 0, credit: 500 },
        { date: at, type: "Invoice", reference: "INV-9", description: "", debit: 500, credit: 0 },
      ],
      new Date(Date.UTC(2026, 9, 1)),
      new Date(Date.UTC(2026, 9, 31)),
    );
    expect(s.rows.map((r) => r.type)).toEqual(["Invoice", "Payment"]);
    expect(s.rows.map((r) => r.balance)).toEqual([500, 0]);
  });

  it("carries an opening balance and a running balance", () => {
    const s = buildStatement(
      [
        { date: new Date(2026, 8, 1), type: "Invoice", reference: "INV-1", description: "", debit: 1000, credit: 0 },
        { date: new Date(2026, 8, 10), type: "Payment", reference: "", description: "", debit: 0, credit: 600 },
        { date: new Date(2026, 9, 2), type: "Invoice", reference: "INV-2", description: "", debit: 300, credit: 0 },
        { date: new Date(2026, 9, 3), type: "Advance", reference: "ADV-1", description: "", debit: 0, credit: 1000 },
      ],
      new Date(2026, 9, 1),
      new Date(2026, 9, 31),
    );
    expect(s.opening).toBe(400);
    expect(s.rows.map((r) => r.balance)).toEqual([700, -300]);
    expect(s.closing).toBe(-300);
    expect(s.totalDebit).toBe(300);
    expect(s.totalCredit).toBe(1000);
  });
});

describe("business dates", () => {
  it("today's date means now; other dates are the start of that day", () => {
    const now = new Date("2026-10-06T14:30:00Z");
    expect(businessDate("2026-10-06", now)).toBe(now);
    expect(businessDate("2026-10-01", now).toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
});

describe("journal entries and account codes", () => {
  it("requires balanced debit/credit lines", () => {
    expect(checkJournal([{ accountId: "a", debit: 100, credit: 0 }])).toMatch(/two lines/);
    expect(checkJournal([{ accountId: "a", debit: 100, credit: 0 }, { accountId: "b", debit: 0, credit: 90 }])).toMatch(/must equal/);
    expect(checkJournal([{ accountId: "a", debit: 100, credit: 100 }, { accountId: "b", debit: 0, credit: 0 }])).toMatch(/two lines|either/);
    expect(checkJournal([{ accountId: "a", debit: 100, credit: 0 }, { accountId: "b", debit: 0, credit: 100 }])).toBeNull();
  });

  it("allocates the next free cash/bank code", () => {
    expect(nextMoneyAccountCode(["1000", "1100"])).toBe("1010");
    expect(nextMoneyAccountCode(["1000", "1010", "1020"])).toBe("1030");
  });
});

describe("financial statements", () => {
  const d = (m: number, day: number) => new Date(2026, m, day);
  const acct = {
    cash: { accountId: "cash", code: "1000", name: "Cash", type: "ASSET" as const, isMoney: true },
    bank: { accountId: "bank", code: "1010", name: "Bank", type: "ASSET" as const, isMoney: true },
    ar: { accountId: "ar", code: "1100", name: "Accounts Receivable", type: "ASSET" as const, isMoney: false },
    adv: { accountId: "adv", code: "2100", name: "Client Advances", type: "LIABILITY" as const, isMoney: false },
    eq: { accountId: "eq", code: "3000", name: "Owner's Equity", type: "EQUITY" as const, isMoney: false },
    rev: { accountId: "rev", code: "4000", name: "Service Revenue", type: "REVENUE" as const, isMoney: false },
    fuel: { accountId: "fuel", code: "5-f", name: "Fuel Expense", type: "EXPENSE" as const, isMoney: false },
  };
  const line = (a: (typeof acct)[keyof typeof acct], direction: "DEBIT" | "CREDIT", amount: number, date: Date, sourceType: string): LedgerRow => ({
    ...a,
    direction,
    amount,
    date,
    sourceType,
  });
  const rows: LedgerRow[] = [
    // opening capital into the bank
    line(acct.bank, "DEBIT", 10000, d(0, 1), "MANUAL"),
    line(acct.eq, "CREDIT", 10000, d(0, 1), "MANUAL"),
    // invoice 3000, paid 3000
    line(acct.ar, "DEBIT", 3000, d(8, 5), "INVOICE_REVENUE"),
    line(acct.rev, "CREDIT", 3000, d(8, 5), "INVOICE_REVENUE"),
    line(acct.bank, "DEBIT", 3000, d(9, 2), "INVOICE_PAYMENT"),
    line(acct.ar, "CREDIT", 3000, d(9, 2), "INVOICE_PAYMENT"),
    // advance 5000 received
    line(acct.bank, "DEBIT", 5000, d(9, 3), "ADVANCE_RECEIPT"),
    line(acct.adv, "CREDIT", 5000, d(9, 3), "ADVANCE_RECEIPT"),
    // fuel paid from cash
    line(acct.fuel, "DEBIT", 200, d(9, 4), "EXPENSE_ACCRUAL"),
    line(acct.cash, "CREDIT", 200, d(9, 4), "EXPENSE_PAYOUT"),
    // move 1000 bank -> cash
    line(acct.cash, "DEBIT", 1000, d(9, 5), "TRANSFER"),
    line(acct.bank, "CREDIT", 1000, d(9, 5), "TRANSFER"),
  ];

  it("profit and loss for a period", () => {
    const pl = profitAndLoss(rows, d(9, 1), d(9, 31));
    expect(pl.totalRevenue).toBe(0);
    expect(pl.totalExpenses).toBe(200);
    const ytd = profitAndLoss(rows, d(0, 1), d(11, 31));
    expect(ytd.totalRevenue).toBe(3000);
    expect(ytd.netProfit).toBe(2800);
    expect(ytd.marginPercent).toBe(93.3);
  });

  it("advances are a liability, not revenue, and the balance sheet balances", () => {
    const bs = balanceSheet(rows, d(11, 31));
    expect(bs.liabilities.find((l) => l.code === "2100")?.amount).toBe(5000);
    expect(bs.earnings).toBe(2800);
    expect(bs.totalAssets).toBe(17800);
    expect(bs.totalLiabilities + bs.totalEquity).toBe(17800);
    expect(bs.balanced).toBe(true);
  });

  it("cash flow groups money movements by cause and ignores internal transfers", () => {
    const cf = cashFlow(rows, d(9, 1), d(9, 31));
    expect(cf.opening).toBe(10000);
    expect(cf.categories.find((c) => c.source === "INVOICE_PAYMENT")?.inflow).toBe(3000);
    expect(cf.categories.find((c) => c.source === "ADVANCE_RECEIPT")?.inflow).toBe(5000);
    expect(cf.categories.find((c) => c.source === "EXPENSE_PAYOUT")?.outflow).toBe(200);
    expect(cf.totalIn).toBe(8000);
    expect(cf.closing).toBe(17800);
    expect(cf.accounts.find((a) => a.code === "1000")?.closing).toBe(800);
    expect(cf.accounts.find((a) => a.code === "1010")?.closing).toBe(17000);
  });

  it("monthly performance", () => {
    const m = monthlyPerformance(rows, d(9, 15), 3);
    expect(m.map((r) => r.label)).toEqual(["Aug 2026", "Sep 2026", "Oct 2026"]);
    expect(m[1].revenue).toBe(3000);
    expect(m[2].profit).toBe(-200);
  });
});

describe("xlsx writer", () => {
  it("crc32 matches the standard check value", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("names columns like Excel", () => {
    expect([0, 25, 26, 27, 701].map(columnName)).toEqual(["A", "Z", "AA", "AB", "ZZ"]);
  });

  it("makes sheet names Excel accepts", () => {
    const used = new Set<string>();
    expect(safeSheetName("P&L: Oct/2026", used)).toBe("P&L  Oct 2026");
    expect(safeSheetName("P&L: Oct/2026", used)).toBe("P&L  Oct 2026 2");
  });

  it("produces a zip with the workbook parts", () => {
    const bytes = buildXlsx([{ name: "Report", title: ["Profit & Loss"], columns: [{ label: "Account" }, { label: "Amount", money: true }], rows: [{ cells: ["Revenue <fees>", 1234.5] }] }]);
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("xl/worksheets/sheet1.xml");
    expect(text).toContain("Revenue &lt;fees&gt;");
    expect(text).toContain("<v>1234.5</v>");
  });
});
