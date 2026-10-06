// Financial statements computed straight from ledger lines: Profit & Loss,
// Balance Sheet, Cash Flow and monthly performance. Pure module (no app
// imports) so the arithmetic is unit tested; the pages only load the rows.

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

export type LedgerRow = {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  direction: "DEBIT" | "CREDIT";
  amount: number;
  date: Date;
  sourceType: string;
  /** The account is a cash box / bank account / mobile money wallet. */
  isMoney: boolean;
};

export type AccountLine = { accountId: string; code: string; name: string; amount: number };

const round = (n: number) => Math.round(n * 100) / 100 || 0;

/** Natural-sign effect of a line: debits increase assets/expenses, credits increase the rest. */
function signed(row: LedgerRow): number {
  const debitNormal = row.type === "ASSET" || row.type === "EXPENSE";
  const dr = row.direction === "DEBIT" ? row.amount : -row.amount;
  return debitNormal ? dr : -dr;
}

function byAccount(rows: LedgerRow[]): AccountLine[] {
  const map = new Map<string, AccountLine>();
  for (const r of rows) {
    const line = map.get(r.accountId) ?? { accountId: r.accountId, code: r.code, name: r.name, amount: 0 };
    line.amount += signed(r);
    map.set(r.accountId, line);
  }
  return [...map.values()]
    .map((l) => ({ ...l, amount: round(l.amount) }))
    .filter((l) => Math.abs(l.amount) >= 0.005)
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}

const sum = (lines: AccountLine[]) => round(lines.reduce((s, l) => s + l.amount, 0));

export type ProfitAndLoss = {
  revenue: AccountLine[];
  expenses: AccountLine[];
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  marginPercent: number | null;
};

export function profitAndLoss(rows: LedgerRow[], from: Date, to: Date): ProfitAndLoss {
  const inPeriod = rows.filter((r) => r.date >= from && r.date <= to);
  const revenue = byAccount(inPeriod.filter((r) => r.type === "REVENUE"));
  const expenses = byAccount(inPeriod.filter((r) => r.type === "EXPENSE"));
  const totalRevenue = sum(revenue);
  const totalExpenses = sum(expenses);
  const netProfit = round(totalRevenue - totalExpenses);
  return {
    revenue,
    expenses,
    totalRevenue,
    totalExpenses,
    netProfit,
    marginPercent: totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 1000) / 10 : null,
  };
}

export type BalanceSheet = {
  assets: AccountLine[];
  liabilities: AccountLine[];
  equity: AccountLine[];
  /** Revenue - expenses to date (no year-end closing entries are posted). */
  earnings: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  balanced: boolean;
};

export function balanceSheet(rows: LedgerRow[], asOf: Date): BalanceSheet {
  const upTo = rows.filter((r) => r.date <= asOf);
  const assets = byAccount(upTo.filter((r) => r.type === "ASSET"));
  const liabilities = byAccount(upTo.filter((r) => r.type === "LIABILITY"));
  const equity = byAccount(upTo.filter((r) => r.type === "EQUITY"));
  const earnings = round(
    sum(byAccount(upTo.filter((r) => r.type === "REVENUE"))) - sum(byAccount(upTo.filter((r) => r.type === "EXPENSE"))),
  );
  const totalAssets = sum(assets);
  const totalLiabilities = sum(liabilities);
  const totalEquity = round(sum(equity) + earnings);
  return {
    assets,
    liabilities,
    equity,
    earnings,
    totalAssets,
    totalLiabilities,
    totalEquity,
    balanced: Math.abs(totalAssets - totalLiabilities - totalEquity) < 0.01,
  };
}

export const CASH_FLOW_CATEGORIES: { source: string; label: string }[] = [
  { source: "INVOICE_PAYMENT", label: "Payments received from clients" },
  { source: "ADVANCE_RECEIPT", label: "Client advances / deposits received" },
  { source: "ADVANCE_REFUND", label: "Refunds paid to clients" },
  { source: "SUPPLIER_PAYMENT", label: "Supplier bills paid" },
  { source: "EXPENSE_PAYOUT", label: "Expenses paid" },
  { source: "MANUAL", label: "Other (journal entries, capital, loans)" },
];

export type CashFlow = {
  opening: number;
  categories: { source: string; label: string; inflow: number; outflow: number; net: number }[];
  totalIn: number;
  totalOut: number;
  net: number;
  closing: number;
  accounts: { accountId: string; code: string; name: string; opening: number; inflow: number; outflow: number; closing: number }[];
};

// Direct method: every movement on a cash / bank / mobile money account,
// grouped by what caused it. Transfers between the company's own accounts
// move money but don't change the total, so they are left out of the
// categories (they still show per account).
export function cashFlow(rows: LedgerRow[], from: Date, to: Date): CashFlow {
  const money = rows.filter((r) => r.isMoney);
  const before = money.filter((r) => r.date < from);
  const during = money.filter((r) => r.date >= from && r.date <= to);
  const opening = round(before.reduce((s, r) => s + signed(r), 0));

  const known = new Set(CASH_FLOW_CATEGORIES.map((c) => c.source));
  const categories = CASH_FLOW_CATEGORIES.map((c) => {
    const lines = during.filter((r) => (known.has(r.sourceType) ? r.sourceType : "MANUAL") === c.source && r.sourceType !== "TRANSFER");
    const inflow = round(lines.filter((r) => signed(r) > 0).reduce((s, r) => s + signed(r), 0));
    const outflow = round(-lines.filter((r) => signed(r) < 0).reduce((s, r) => s + signed(r), 0));
    return { ...c, inflow, outflow, net: round(inflow - outflow) };
  }).filter((c) => c.inflow > 0 || c.outflow > 0);

  const totalIn = round(categories.reduce((s, c) => s + c.inflow, 0));
  const totalOut = round(categories.reduce((s, c) => s + c.outflow, 0));
  const net = round(totalIn - totalOut);

  const accountIds = [...new Set(money.map((r) => r.accountId))];
  const accounts = accountIds
    .map((id) => {
      const first = money.find((r) => r.accountId === id)!;
      const op = round(before.filter((r) => r.accountId === id).reduce((s, r) => s + signed(r), 0));
      const lines = during.filter((r) => r.accountId === id);
      const inflow = round(lines.filter((r) => signed(r) > 0).reduce((s, r) => s + signed(r), 0));
      const outflow = round(-lines.filter((r) => signed(r) < 0).reduce((s, r) => s + signed(r), 0));
      return { accountId: id, code: first.code, name: first.name, opening: op, inflow, outflow, closing: round(op + inflow - outflow) };
    })
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  return { opening, categories, totalIn, totalOut, net, closing: round(opening + net), accounts };
}

export type MonthRow = { month: string; label: string; revenue: number; expenses: number; profit: number };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Revenue, expenses and profit for each of the `count` months ending with the month of `end`. */
export function monthlyPerformance(rows: LedgerRow[], end: Date, count = 12): MonthRow[] {
  const out: MonthRow[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(end.getFullYear(), end.getMonth() - i, 1);
    const stop = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const inMonth = rows.filter((r) => r.date >= start && r.date < stop);
    const revenue = round(inMonth.filter((r) => r.type === "REVENUE").reduce((s, r) => s + signed(r), 0));
    const expenses = round(inMonth.filter((r) => r.type === "EXPENSE").reduce((s, r) => s + signed(r), 0));
    out.push({
      month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
      label: `${MONTHS[start.getMonth()]} ${start.getFullYear()}`,
      revenue,
      expenses,
      profit: round(revenue - expenses),
    });
  }
  return out;
}

/** Balance of each account as of a date (natural sign). */
export function balancesAsOf(rows: LedgerRow[], asOf: Date): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.date > asOf) continue;
    map.set(r.accountId, round((map.get(r.accountId) ?? 0) + signed(r)));
  }
  return map;
}
