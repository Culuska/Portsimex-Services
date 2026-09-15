import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { formatCurrency } from "@/lib/format";

type AccountBalanceRow = {
  account_id: string;
  code: string;
  name: string;
  type: string;
  is_system: boolean;
  total_debits: string | number;
  total_credits: string | number;
  balance: string | number;
};

const TYPE_LABELS: Record<string, string> = {
  ASSET: "Assets",
  LIABILITY: "Liabilities",
  EQUITY: "Equity",
  REVENUE: "Revenue",
  EXPENSE: "Expenses",
};
const TYPE_ORDER = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];

export default async function ChartOfAccountsPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/");

  // Running balances come from the account_balances SQL view (migration
  // 20260915140000), which aggregates ledger_lines per account using the
  // index on accountId rather than the app computing it row by row.
  const rows = await prisma.$queryRaw<AccountBalanceRow[]>`
    SELECT * FROM account_balances ORDER BY code ASC
  `;

  const byType = TYPE_ORDER.map((type) => ({
    type,
    rows: rows.filter((r) => r.type === type),
  })).filter((g) => g.rows.length > 0);

  return (
    <div>
      <PageHeader
        title="Chart of Accounts"
        description="Live balances from the double-entry ledger"
        action={
          <div className="flex gap-2">
            <Link
              href="/accounting/ledger"
              className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Ledger
            </Link>
            <Link
              href="/accounting/margins"
              className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Net Job Margin
            </Link>
          </div>
        }
      />
      {rows.length === 0 ? (
        <EmptyState message="No ledger activity yet. Accounts appear here as invoices are sent and expenses are recorded." />
      ) : (
        <div className="flex flex-col gap-6">
          {byType.map((group) => (
            <Card key={group.type} className="p-0">
              <h2 className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-50">
                {TYPE_LABELS[group.type]}
              </h2>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Code</th>
                    <th className="px-4 py-2 font-medium">Account</th>
                    <th className="px-4 py-2 font-medium text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {group.rows.map((r) => (
                    <tr key={r.account_id}>
                      <td className="px-4 py-2 text-zinc-500">{r.code}</td>
                      <td className="px-4 py-2 text-zinc-900 dark:text-zinc-50">{r.name}</td>
                      <td className="px-4 py-2 text-right font-medium text-zinc-900 dark:text-zinc-50">
                        {formatCurrency(Number(r.balance))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
