// Financial reports, each built once as plain data and then rendered as a
// page, printed to PDF, or exported to Excel from the same numbers.
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { invoiceBalance, invoiceGrandTotal, netLineAmount } from "@/lib/invoices";
import { AGING_BUCKETS, AGING_LABELS, ageItems, buildStatement, daysPastDue, type AgingItem, type StatementEntry } from "@/lib/finance-rules";
import { balanceSheet, cashFlow, monthlyPerformance, profitAndLoss, type AccountType, type LedgerRow } from "@/lib/statements";
import { SERVICE_CATEGORY_LABELS } from "@/lib/service-templates";
import { balanceOfAdvance, PAYMENT_METHOD_LABELS } from "@/lib/finance";

export type ReportCell = string | number | null;
export type ReportColumn = { label: string; money?: boolean };
export type ReportRow = { cells: ReportCell[]; bold?: boolean; href?: string; muted?: boolean };
export type ReportSection = { heading?: string; columns: ReportColumn[]; rows: ReportRow[]; empty?: string };
export type Report = {
  key: ReportKey;
  title: string;
  subtitle: string;
  sections: ReportSection[];
  notes?: string[];
  /** A warning shown prominently (e.g. a balance sheet that doesn't balance). */
  alert?: string;
};

export type ReportParams = { from: Date; to: Date; clientId?: string };

export const REPORTS = {
  "profit-loss": { title: "Profit & Loss", filter: "period", staff: false },
  "balance-sheet": { title: "Balance Sheet", filter: "asOf", staff: false },
  "cash-flow": { title: "Cash Flow", filter: "period", staff: false },
  receivables: { title: "Accounts Receivable", filter: "asOf", staff: true },
  payables: { title: "Accounts Payable", filter: "asOf", staff: true },
  expenses: { title: "Expense Report", filter: "period", staff: false },
  revenue: { title: "Revenue Report", filter: "period", staff: false },
  monthly: { title: "Monthly Performance", filter: "asOf", staff: false },
  statement: { title: "Client Statement", filter: "period", staff: true },
} as const;
export type ReportKey = keyof typeof REPORTS;

export function isReportKey(k: string): k is ReportKey {
  return k in REPORTS;
}

const round = (n: number) => Math.round(n * 100) / 100;
const periodLabel = (p: ReportParams) => `${formatDate(p.from)} to ${formatDate(p.to)}`;
const asOfLabel = (p: ReportParams) => `As of ${formatDate(p.to)}`;

export async function loadLedgerRows(to: Date): Promise<LedgerRow[]> {
  const rows = await prisma.$queryRaw<
    { accountId: string; code: string; name: string; type: string; direction: string; amount: number; date: Date; sourceType: string; isMoney: boolean }[]
  >`
    SELECT ll."accountId", a.code, a.name, a.type::text AS type, ll.direction::text AS direction,
           ll.amount::float8 AS amount, lt."transactionDate" AS date, lt."sourceType"::text AS "sourceType",
           (ma.id IS NOT NULL OR a.code = '1000') AS "isMoney"
    FROM ledger_lines ll
    JOIN ledger_transactions lt ON lt.id = ll."transactionId"
    JOIN accounts a ON a.id = ll."accountId"
    LEFT JOIN money_accounts ma ON ma."accountId" = a.id
    WHERE lt."transactionDate" <= ${to}
  `;
  return rows.map((r) => ({ ...r, type: r.type as AccountType, direction: r.direction as "DEBIT" | "CREDIT", amount: Number(r.amount) }));
}

async function profitLossReport(p: ReportParams): Promise<Report> {
  const pl = profitAndLoss(await loadLedgerRows(p.to), p.from, p.to);
  const cols = [{ label: "Account" }, { label: "Amount", money: true }];
  return {
    key: "profit-loss",
    title: "Profit & Loss",
    subtitle: periodLabel(p),
    sections: [
      {
        heading: "Revenue",
        columns: cols,
        rows: [...pl.revenue.map((l) => ({ cells: [`${l.code} ${l.name}`, l.amount] })), { cells: ["Total revenue", pl.totalRevenue], bold: true }],
      },
      {
        heading: "Expenses",
        columns: cols,
        rows: [...pl.expenses.map((l) => ({ cells: [`${l.code} ${l.name}`, l.amount] })), { cells: ["Total expenses", pl.totalExpenses], bold: true }],
      },
      {
        heading: "Result",
        columns: cols,
        rows: [
          { cells: ["Net profit", pl.netProfit], bold: true },
          { cells: ["Net margin", pl.marginPercent === null ? "—" : `${pl.marginPercent}%`] },
        ],
      },
    ],
    notes: [
      "Revenue is recognized when an invoice is issued; costs when they are incurred.",
      "Costs paid on a client's behalf and re-charged at cost are not revenue or expense -- they sit in Client Disbursements Recoverable until invoiced.",
      "Client advances are a liability until applied to an invoice, so they never appear here.",
    ],
  };
}

async function balanceSheetReport(p: ReportParams): Promise<Report> {
  const bs = balanceSheet(await loadLedgerRows(p.to), p.to);
  const cols = [{ label: "Account" }, { label: "Amount", money: true }];
  return {
    key: "balance-sheet",
    title: "Balance Sheet",
    subtitle: asOfLabel(p),
    sections: [
      {
        heading: "Assets",
        columns: cols,
        rows: [...bs.assets.map((l) => ({ cells: [`${l.code} ${l.name}`, l.amount] })), { cells: ["Total assets", bs.totalAssets], bold: true }],
      },
      {
        heading: "Liabilities",
        columns: cols,
        rows: [...bs.liabilities.map((l) => ({ cells: [`${l.code} ${l.name}`, l.amount] })), { cells: ["Total liabilities", bs.totalLiabilities], bold: true }],
      },
      {
        heading: "Equity",
        columns: cols,
        rows: [
          ...bs.equity.map((l) => ({ cells: [`${l.code} ${l.name}`, l.amount] })),
          { cells: ["Retained earnings (profit to date)", bs.earnings] },
          { cells: ["Total equity", bs.totalEquity], bold: true },
        ],
      },
      {
        heading: "Check",
        columns: cols,
        rows: [{ cells: ["Liabilities + equity", round(bs.totalLiabilities + bs.totalEquity)], bold: true }],
      },
    ],
    alert: bs.balanced ? undefined : "Assets do not equal liabilities + equity -- please contact support.",
    notes: ["Opening balances (bank balances, owner capital, loans) are entered as journal entries under Finance → Journal."],
  };
}

async function cashFlowReport(p: ReportParams): Promise<Report> {
  const cf = cashFlow(await loadLedgerRows(p.to), p.from, p.to);
  return {
    key: "cash-flow",
    title: "Cash Flow",
    subtitle: periodLabel(p),
    sections: [
      {
        heading: "Where the money came from and went",
        columns: [{ label: "Activity" }, { label: "Money in", money: true }, { label: "Money out", money: true }, { label: "Net", money: true }],
        rows: [
          { cells: ["Opening cash & bank", null, null, cf.opening], muted: true },
          ...cf.categories.map((c) => ({ cells: [c.label, c.inflow || null, c.outflow || null, c.net] as ReportCell[] })),
          { cells: ["Net change", cf.totalIn, cf.totalOut, cf.net], bold: true },
          { cells: ["Closing cash & bank", null, null, cf.closing], bold: true },
        ],
      },
      {
        heading: "By account",
        columns: [{ label: "Account" }, { label: "Opening", money: true }, { label: "In", money: true }, { label: "Out", money: true }, { label: "Closing", money: true }],
        rows: cf.accounts.map((a) => ({ cells: [`${a.code} ${a.name}`, a.opening, a.inflow, a.outflow, a.closing] })),
        empty: "No cash or bank activity yet.",
      },
    ],
    notes: ["Transfers between the company's own accounts change the per-account figures but not the total."],
  };
}

async function receivablesReport(p: ReportParams): Promise<Report> {
  const [invoices, advances] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: { not: "CANCELLED" }, OR: [{ revenueRecognizedAt: { lte: p.to } }, { status: { not: "DRAFT" }, revenueRecognizedAt: null, issueDate: { lte: p.to } }] },
      include: { client: true, items: true, payments: { where: { paidAt: { lte: p.to } } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.clientAdvance.findMany({
      where: { receivedAt: { lte: p.to } },
      include: { client: true, applications: { where: { paidAt: { lte: p.to } } }, refunds: { where: { refundedAt: { lte: p.to } } } },
    }),
  ]);
  const open = invoices.map((i) => ({ i, balance: invoiceBalance(i) })).filter((x) => x.balance > 0.005);
  const outsideLedger = open.filter((x) => !x.i.revenueRecognizedAt);
  const items: AgingItem[] = open.map(({ i, balance }) => ({ key: i.clientId, label: i.client.name, dueDate: i.dueDate, balance }));
  const aged = ageItems(items, p.to);
  const credit = new Map<string, number>();
  for (const a of advances) credit.set(a.clientId, round((credit.get(a.clientId) ?? 0) + balanceOfAdvance(a).remaining));

  return {
    key: "receivables",
    title: "Accounts Receivable",
    subtitle: asOfLabel(p),
    sections: [
      {
        heading: "Aging by client",
        columns: [{ label: "Client" }, ...AGING_BUCKETS.map((b) => ({ label: AGING_LABELS[b], money: true })), { label: "Total owed", money: true }, { label: "Credit available", money: true }],
        rows: [
          ...aged.rows.map((r) => ({
            cells: [r.label, ...AGING_BUCKETS.map((b) => r.buckets[b] || null), r.total, credit.get(r.key) || null] as ReportCell[],
            href: `/finance/reports/statement?client=${r.key}`,
          })),
          { cells: ["Total", ...AGING_BUCKETS.map((b) => aged.totals[b]), aged.total, round([...credit.values()].reduce((s, v) => s + v, 0))], bold: true },
        ],
        empty: "No client owes anything.",
      },
      {
        heading: "Open invoices",
        columns: [{ label: "Invoice" }, { label: "Client" }, { label: "Issued" }, { label: "Due" }, { label: "Days overdue" }, { label: "Total", money: true }, { label: "Paid", money: true }, { label: "Balance", money: true }],
        rows: open.map(({ i, balance }) => {
          const late = daysPastDue(i.dueDate, p.to);
          const total = invoiceGrandTotal(i);
          return {
            cells: [i.invoiceNumber, i.client.name, formatDate(i.issueDate), formatDate(i.dueDate), late > 0 ? late : null, total, round(total - balance), balance],
            href: `/invoices/${i.id}`,
          };
        }),
        empty: "No open invoices.",
      },
    ],
    notes: outsideLedger.length
      ? [
          `${outsideLedger.map((x) => x.i.invoiceNumber).join(", ")} ${outsideLedger.length === 1 ? "was" : "were"} issued before the accounting ledger was set up, so ${outsideLedger.length === 1 ? "it is" : "they are"} owed but not in the Accounts Receivable balance. Post a journal entry (Dr 1100 / Cr 4000) if ${outsideLedger.length === 1 ? "it" : "they"} should be.`,
        ]
      : undefined,
  };
}

async function payablesReport(p: ReportParams): Promise<Report> {
  const [bills, expenses] = await Promise.all([
    prisma.supplierBill.findMany({
      where: { status: { not: "CANCELLED" }, billDate: { lte: p.to } },
      include: { vendor: true, lines: { select: { amount: true, status: true } }, payments: { where: { paidAt: { lte: p.to } } } },
      orderBy: { dueDate: "asc" },
    }),
    // Costs recorded on their own (not on a supplier bill) that are still unpaid.
    prisma.expense.findMany({
      where: {
        supplierBillId: null,
        accrualPostedAt: { not: null },
        accrualReversedAt: null,
        status: { not: "REJECTED" },
        incurredAt: { lte: p.to },
        OR: [{ payoutPostedAt: null }, { paidAt: { gt: p.to } }],
      },
      include: { vendor: true, job: true },
      orderBy: { incurredAt: "asc" },
    }),
  ]);
  const openBills = bills
    .map((b) => {
      const total = b.lines.filter((l) => l.status !== "REJECTED").reduce((s, l) => s + Number(l.amount), 0);
      const paid = b.payments.reduce((s, x) => s + Number(x.amount), 0);
      return { b, total: round(total), paid: round(paid), balance: round(total - paid) };
    })
    .filter((x) => x.balance > 0.005);
  const items: AgingItem[] = [
    ...openBills.map((x) => ({ key: x.b.vendorId, label: x.b.vendor.name, dueDate: x.b.dueDate, balance: x.balance })),
    ...expenses.map((e) => ({ key: e.vendorId ?? "none", label: e.vendor?.name ?? "No supplier recorded", dueDate: e.incurredAt, balance: Number(e.amount) })),
  ];
  const aged = ageItems(items, p.to);
  return {
    key: "payables",
    title: "Accounts Payable",
    subtitle: asOfLabel(p),
    sections: [
      {
        heading: "Aging by supplier",
        columns: [{ label: "Supplier" }, ...AGING_BUCKETS.map((b) => ({ label: AGING_LABELS[b], money: true })), { label: "Total owed", money: true }],
        rows: [
          ...aged.rows.map((r) => ({ cells: [r.label, ...AGING_BUCKETS.map((b) => r.buckets[b] || null), r.total] as ReportCell[] })),
          { cells: ["Total", ...AGING_BUCKETS.map((b) => aged.totals[b]), aged.total], bold: true },
        ],
        empty: "Nothing is owed to suppliers.",
      },
      {
        heading: "Open supplier bills",
        columns: [{ label: "Bill" }, { label: "Supplier" }, { label: "Supplier ref" }, { label: "Due" }, { label: "Total", money: true }, { label: "Paid", money: true }, { label: "Balance", money: true }],
        rows: openBills.map((x) => ({
          cells: [x.b.billNumber, x.b.vendor.name, x.b.supplierReference ?? "", formatDate(x.b.dueDate), x.total, x.paid, x.balance],
          href: `/finance/bills/${x.b.id}`,
        })),
        empty: "No open supplier bills.",
      },
      {
        heading: "Unpaid expenses (not on a bill)",
        columns: [{ label: "Expense" }, { label: "Description" }, { label: "Supplier" }, { label: "Job" }, { label: "Date" }, { label: "Status" }, { label: "Amount", money: true }],
        rows: expenses.map((e) => ({
          cells: [e.expenseNumber ?? "", e.description, e.vendor?.name ?? "", e.job?.jobNumber ?? "", formatDate(e.incurredAt), e.status.replace(/_/g, " ").toLowerCase(), Number(e.amount)],
          href: `/expenses/${e.id}`,
        })),
        empty: "No unpaid expenses.",
      },
    ],
  };
}

const BILLING_LABELS: Record<string, string> = {
  NON_BILLABLE: "Company cost",
  BILLABLE: "Billable at cost",
  BILLABLE_WITH_MARKUP: "Billable + fee",
};

async function expensesReport(p: ReportParams): Promise<Report> {
  const expenses = await prisma.expense.findMany({
    where: { incurredAt: { gte: p.from, lte: p.to }, status: { not: "REJECTED" } },
    include: { category: true, vendor: true, job: true },
    orderBy: { incurredAt: "asc" },
  });
  const byCat = new Map<string, { company: number; billable: number; count: number }>();
  for (const e of expenses) {
    const row = byCat.get(e.category.name) ?? { company: 0, billable: 0, count: 0 };
    if (e.billingType === "NON_BILLABLE") row.company += Number(e.amount);
    else row.billable += Number(e.amount);
    row.count += 1;
    byCat.set(e.category.name, row);
  }
  const cats = [...byCat.entries()].sort((a, b) => b[1].company + b[1].billable - (a[1].company + a[1].billable));
  const company = round(cats.reduce((s, [, r]) => s + r.company, 0));
  const billable = round(cats.reduce((s, [, r]) => s + r.billable, 0));
  return {
    key: "expenses",
    title: "Expense Report",
    subtitle: periodLabel(p),
    sections: [
      {
        heading: "By category",
        columns: [{ label: "Category" }, { label: "Entries" }, { label: "Company cost", money: true }, { label: "Billable to clients", money: true }, { label: "Total", money: true }],
        rows: [
          ...cats.map(([name, r]) => ({ cells: [name, r.count, round(r.company), round(r.billable), round(r.company + r.billable)] as ReportCell[] })),
          { cells: ["Total", expenses.length, company, billable, round(company + billable)], bold: true },
        ],
        empty: "No expenses in this period.",
      },
      {
        heading: "All expenses",
        columns: [{ label: "Date" }, { label: "Number" }, { label: "Description" }, { label: "Category" }, { label: "Supplier" }, { label: "Job" }, { label: "Billing" }, { label: "Status" }, { label: "Amount", money: true }],
        rows: expenses.map((e) => ({
          cells: [
            formatDate(e.incurredAt),
            e.expenseNumber ?? "",
            e.description,
            e.category.name,
            e.vendor?.name ?? "",
            e.job?.jobNumber ?? "",
            BILLING_LABELS[e.billingType] ?? e.billingType,
            e.status.replace(/_/g, " ").toLowerCase(),
            Number(e.amount),
          ],
          href: `/expenses/${e.id}`,
        })),
        empty: "No expenses in this period.",
      },
    ],
    notes: ["Billable costs are recovered from clients on their invoices; only company costs reduce profit."],
  };
}

async function revenueReport(p: ReportParams): Promise<Report> {
  const lines = await prisma.invoiceItem.findMany({
    where: { invoice: { status: { not: "CANCELLED" }, revenueRecognizedAt: { not: null }, issueDate: { gte: p.from, lte: p.to } } },
    include: {
      job: { include: { service: true } },
      invoice: { include: { client: true, items: { select: { quantity: true, unitPrice: true, sourceExpenseId: true } } } },
    },
  });
  type Agg = { fees: number; recharged: number };
  const byService = new Map<string, Agg>();
  const byClient = new Map<string, Agg & { name: string; id: string }>();
  for (const l of lines) {
    const amount = netLineAmount(l, l.invoice);
    const key = l.job ? SERVICE_CATEGORY_LABELS[l.job.service.category] : "Not linked to a job";
    const s = byService.get(key) ?? { fees: 0, recharged: 0 };
    const c = byClient.get(l.invoice.clientId) ?? { fees: 0, recharged: 0, name: l.invoice.client.name, id: l.invoice.clientId };
    if (l.sourceExpenseId) {
      s.recharged += amount;
      c.recharged += amount;
    } else {
      s.fees += amount;
      c.fees += amount;
    }
    byService.set(key, s);
    byClient.set(l.invoice.clientId, c);
  }
  const cols = (first: string) => [{ label: first }, { label: "Service fees (revenue)", money: true }, { label: "Costs re-charged", money: true }, { label: "Total billed", money: true }];
  const rowsOf = (entries: [string, Agg][]) => entries.sort((a, b) => b[1].fees - a[1].fees).map(([k, v]) => ({ cells: [k, round(v.fees), round(v.recharged), round(v.fees + v.recharged)] as ReportCell[] }));
  const fees = round(lines.filter((l) => !l.sourceExpenseId).reduce((s, l) => s + netLineAmount(l, l.invoice), 0));
  const recharged = round(lines.filter((l) => l.sourceExpenseId).reduce((s, l) => s + netLineAmount(l, l.invoice), 0));
  const totalRow = { cells: ["Total", fees, recharged, round(fees + recharged)] as ReportCell[], bold: true };
  return {
    key: "revenue",
    title: "Revenue Report",
    subtitle: periodLabel(p),
    sections: [
      { heading: "By service", columns: cols("Service"), rows: [...rowsOf([...byService.entries()]), totalRow], empty: "No invoices issued in this period." },
      {
        heading: "By client",
        columns: cols("Client"),
        rows: [
          ...[...byClient.values()]
            .sort((a, b) => b.fees - a.fees)
            .map((c) => ({ cells: [c.name, round(c.fees), round(c.recharged), round(c.fees + c.recharged)] as ReportCell[], href: `/clients/${c.id}` })),
          totalRow,
        ],
        empty: "No invoices issued in this period.",
      },
    ],
    notes: ["Amounts are net of discounts and exclude tax. Re-charged costs are recoveries, not revenue."],
  };
}

async function monthlyReport(p: ReportParams): Promise<Report> {
  const months = monthlyPerformance(await loadLedgerRows(p.to), p.to, 12);
  const sum = (f: (m: (typeof months)[number]) => number) => round(months.reduce((s, m) => s + f(m), 0));
  return {
    key: "monthly",
    title: "Monthly Performance",
    subtitle: `12 months to ${formatDate(p.to)}`,
    sections: [
      {
        columns: [{ label: "Month" }, { label: "Revenue", money: true }, { label: "Expenses", money: true }, { label: "Profit", money: true }, { label: "Margin" }],
        rows: [
          ...months.map((m) => ({
            cells: [m.label, m.revenue, m.expenses, m.profit, m.revenue > 0 ? `${Math.round((m.profit / m.revenue) * 1000) / 10}%` : "—"] as ReportCell[],
          })),
          { cells: ["Total", sum((m) => m.revenue), sum((m) => m.expenses), sum((m) => m.profit), null], bold: true },
        ],
      },
    ],
  };
}

export async function statementEntries(clientId: string): Promise<StatementEntry[]> {
  const [invoices, payments, advances, refunds] = await Promise.all([
    prisma.invoice.findMany({
      where: { clientId, OR: [{ revenueRecognizedAt: { not: null } }, { status: { notIn: ["DRAFT", "CANCELLED"] } }] },
      include: { items: true },
    }),
    prisma.payment.findMany({ where: { invoice: { clientId }, advanceId: null }, include: { invoice: true } }),
    prisma.clientAdvance.findMany({ where: { clientId } }),
    prisma.advanceRefund.findMany({ where: { advance: { clientId } }, include: { advance: true } }),
  ]);
  const entries: StatementEntry[] = [];
  for (const i of invoices) {
    const total = invoiceGrandTotal(i);
    entries.push({ date: i.issueDate, type: "Invoice", reference: i.invoiceNumber, description: `Due ${formatDate(i.dueDate)}`, debit: total, credit: 0 });
    if (i.status === "CANCELLED" && i.cancelledAt) {
      entries.push({ date: i.cancelledAt, type: "Cancelled", reference: i.invoiceNumber, description: i.cancelReason ?? "Invoice cancelled", debit: 0, credit: total });
    }
  }
  for (const pay of payments) {
    entries.push({
      date: pay.paidAt,
      type: "Payment",
      reference: pay.invoice.invoiceNumber,
      description: `${PAYMENT_METHOD_LABELS[pay.method] ?? pay.method}${pay.reference ? ` · ${pay.reference}` : ""}`,
      debit: 0,
      credit: Number(pay.amount),
    });
  }
  for (const a of advances) {
    entries.push({
      date: a.receivedAt,
      type: a.source === "OVERPAYMENT" ? "Overpayment credit" : "Advance received",
      reference: a.advanceNumber,
      description: a.notes ?? PAYMENT_METHOD_LABELS[a.method] ?? "",
      debit: 0,
      credit: Number(a.amount),
    });
  }
  for (const r of refunds) {
    entries.push({ date: r.refundedAt, type: "Refund paid", reference: r.advance.advanceNumber, description: r.reason, debit: Number(r.amount), credit: 0 });
  }
  return entries;
}

async function statementReport(p: ReportParams): Promise<Report> {
  if (!p.clientId) {
    return { key: "statement", title: "Client Statement", subtitle: "Choose a client", sections: [] };
  }
  const client = await prisma.client.findUniqueOrThrow({ where: { id: p.clientId } });
  const st = buildStatement(await statementEntries(client.id), p.from, p.to);
  const owes = (n: number) => (n < -0.005 ? `${client.name} is in credit` : n > 0.005 ? `${client.name} owes` : "Settled");
  return {
    key: "statement",
    title: `Statement of Account -- ${client.name}`,
    subtitle: periodLabel(p),
    sections: [
      {
        columns: [{ label: "Date" }, { label: "Type" }, { label: "Reference" }, { label: "Details" }, { label: "Charges", money: true }, { label: "Payments & credits", money: true }, { label: "Balance", money: true }],
        rows: [
          { cells: [formatDate(p.from), "Opening balance", "", "", null, null, st.opening], muted: true },
          ...st.rows.map((r) => ({ cells: [formatDate(r.date), r.type, r.reference, r.description, r.debit || null, r.credit || null, r.balance] as ReportCell[] })),
          { cells: [formatDate(p.to), "Closing balance", "", owes(st.closing), st.totalDebit, st.totalCredit, st.closing], bold: true },
        ],
      },
    ],
    notes: [
      `${client.name}${client.taxNumber ? ` · Tax no. ${client.taxNumber}` : ""}${client.address ? ` · ${client.address}` : ""}`,
      "A negative balance means the client has paid in advance (credit to be used on future invoices or refunded).",
    ],
  };
}

export async function buildReport(key: ReportKey, params: ReportParams): Promise<Report> {
  switch (key) {
    case "profit-loss":
      return profitLossReport(params);
    case "balance-sheet":
      return balanceSheetReport(params);
    case "cash-flow":
      return cashFlowReport(params);
    case "receivables":
      return receivablesReport(params);
    case "payables":
      return payablesReport(params);
    case "expenses":
      return expensesReport(params);
    case "revenue":
      return revenueReport(params);
    case "monthly":
      return monthlyReport(params);
    case "statement":
      return statementReport(params);
  }
}

/** Default period: this month to date; "as of" reports: today. */
export function defaultPeriod(now = new Date()) {
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
}
