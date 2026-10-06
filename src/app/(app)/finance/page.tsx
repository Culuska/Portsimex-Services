import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader, StatCard } from "@/components/ui";
import ActionForm, { fieldClass } from "@/components/ActionForm";
import { formatCurrency } from "@/lib/format";
import { activeMoneyAccounts, MONEY_ACCOUNT_KIND_LABELS } from "@/lib/finance";
import { financeViewer } from "@/lib/finance-access";
import { loadLedgerRows, REPORTS } from "@/lib/finance-reports";
import { balancesAsOf, profitAndLoss } from "@/lib/statements";
import { createMoneyAccountAction, transferAction } from "./actions";

const REPORT_BLURBS: Record<keyof typeof REPORTS, string> = {
  "profit-loss": "Revenue, expenses and net profit for a period",
  "balance-sheet": "What the company owns and owes on a date",
  "cash-flow": "Money in and out of cash, bank and mobile money",
  receivables: "Who owes us, aged by due date",
  payables: "What we owe suppliers, aged by due date",
  expenses: "Costs by category -- company vs billable",
  revenue: "Revenue by service and by client",
  monthly: "Revenue, expenses and profit month by month",
  statement: "Statement of account to send a client",
};

export default async function FinancePage() {
  const viewer = await financeViewer();
  if (!viewer.isStaff) redirect("/");

  const now = new Date();
  const [accounts, rows, openBills, advancesCount] = await Promise.all([
    activeMoneyAccounts().then(() =>
      prisma.moneyAccount.findMany({ orderBy: [{ isDefault: "desc" }, { name: "asc" }], include: { account: true } }),
    ),
    loadLedgerRows(now),
    prisma.supplierBill.count({ where: { status: { in: ["OPEN", "PARTIALLY_PAID"] } } }),
    prisma.clientAdvance.count(),
  ]);
  const balances = balancesAsOf(rows, now);
  const byCode = (code: string) => {
    const r = rows.find((x) => x.code === code);
    return r ? (balances.get(r.accountId) ?? 0) : 0;
  };
  const money = accounts.map((a) => ({ ...a, balance: balances.get(a.accountId) ?? 0 }));
  const totalMoney = money.reduce((s, a) => s + a.balance, 0);
  const month = profitAndLoss(rows, new Date(now.getFullYear(), now.getMonth(), 1), now);
  const year = profitAndLoss(rows, new Date(now.getFullYear(), 0, 1), now);
  const reportKeys = (Object.keys(REPORTS) as (keyof typeof REPORTS)[]).filter((k) => viewer.isManager || REPORTS[k].staff);

  return (
    <div>
      <PageHeader
        title="Finance"
        description="Cash and bank, client advances, supplier bills and financial reports"
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/finance/advances" className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
              Client advances
            </Link>
            <Link href="/finance/bills" className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
              Supplier bills
            </Link>
            {viewer.isManager && (
              <Link href="/finance/journal" className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                Journal entries
              </Link>
            )}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Cash, bank & mobile money" value={formatCurrency(totalMoney)} hint={`${money.length} account${money.length === 1 ? "" : "s"}`} />
        <StatCard label="Receivables" value={formatCurrency(byCode("1100"))} hint="owed by clients" />
        <StatCard label="Payables" value={formatCurrency(byCode("2000"))} hint={`${openBills} open supplier bill${openBills === 1 ? "" : "s"}`} />
        <StatCard label="Client advances" value={formatCurrency(byCode("2100"))} hint={`unused deposits & credits · ${advancesCount} received`} />
        {viewer.isManager && (
          <>
            <StatCard label="Profit this month" value={formatCurrency(month.netProfit)} hint={`revenue ${formatCurrency(month.totalRevenue)}`} />
            <StatCard label={`Profit ${now.getFullYear()} to date`} value={formatCurrency(year.netProfit)} hint={year.marginPercent !== null ? `${year.marginPercent}% margin` : undefined} />
            <StatCard label="Tax payable" value={formatCurrency(byCode("2200"))} hint="charged on invoices" />
            <StatCard label="Client disbursements" value={formatCurrency(byCode("1200"))} hint="paid for clients, to recover" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-0">
          <h2 className="border-b border-zinc-200 px-4 py-3 font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">Cash & bank accounts</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {money.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2">
                    {viewer.isManager ? (
                      <Link href={`/finance/accounts/${a.id}`} className="font-medium text-brand-600 hover:underline">
                        {a.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{a.name}</span>
                    )}
                    <p className="text-xs text-zinc-500">
                      {MONEY_ACCOUNT_KIND_LABELS[a.kind]}
                      {a.bankName ? ` · ${a.bankName}` : ""}
                      {a.accountNumber ? ` · ${a.accountNumber}` : ""} · {a.account.code}
                      {a.isDefault ? " · default" : ""}
                    </p>
                  </td>
                  <td className={`px-4 py-2 text-right font-medium tabular-nums ${a.balance < 0 ? "text-red-600" : ""}`}>{formatCurrency(a.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {viewer.isManager && (
            <div className="flex flex-col gap-3 border-t border-zinc-200 p-4 dark:border-zinc-800">
              <details>
                <summary className="cursor-pointer text-sm font-medium text-brand-600">Add a bank / cash / mobile money account…</summary>
                <ActionForm action={createMoneyAccountAction} submitLabel="Add account" className="mt-3 grid grid-cols-2 gap-3">
                  <input name="name" required placeholder="Name (e.g. KCB USD account)" className={`${fieldClass} col-span-2`} />
                  <select name="kind" defaultValue="BANK" className={fieldClass}>
                    <option value="BANK">Bank</option>
                    <option value="CASH">Cash</option>
                    <option value="MOBILE_MONEY">Mobile money</option>
                  </select>
                  <input name="currency" defaultValue="USD" maxLength={3} className={fieldClass} aria-label="Currency" />
                  <input name="bankName" placeholder="Bank / provider" className={fieldClass} />
                  <input name="accountNumber" placeholder="Account / wallet number" className={fieldClass} />
                </ActionForm>
              </details>
              {money.length > 1 && (
                <details>
                  <summary className="cursor-pointer text-sm font-medium text-brand-600">Transfer between accounts…</summary>
                  <ActionForm action={transferAction} submitLabel="Record transfer" className="mt-3 grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
                      From
                      <select name="fromId" className={fieldClass}>
                        {money.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
                      To
                      <select name="toId" defaultValue={money[1]?.id} className={fieldClass}>
                        {money.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <input name="amount" type="number" min="0.01" step="0.01" required placeholder="Amount" className={fieldClass} />
                    <input name="transferredAt" type="date" required defaultValue={now.toISOString().slice(0, 10)} className={fieldClass} />
                    <input name="reference" placeholder="Reference (deposit slip...)" className={`${fieldClass} col-span-2`} />
                  </ActionForm>
                </details>
              )}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">Reports</h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {reportKeys.map((k) => (
              <li key={k}>
                <Link href={`/finance/reports/${k}`} className="block rounded-md border border-zinc-200 px-3 py-2 hover:border-brand-400 hover:bg-brand-50/40 dark:border-zinc-800 dark:hover:bg-zinc-900">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{REPORTS[k].title}</p>
                  <p className="text-xs text-zinc-500">{REPORT_BLURBS[k]}</p>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-zinc-500">Every report can be printed / saved as PDF or downloaded to Excel.</p>
        </Card>
      </div>
    </div>
  );
}
