import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, EmptyState, Badge } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";

export default async function LedgerPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/");

  const transactions = await prisma.ledgerTransaction.findMany({
    orderBy: { transactionDate: "desc" },
    take: 100,
    include: { lines: { include: { account: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Ledger"
        description="Most recent 100 journal entries, every debit balanced by a credit"
        action={
          <Link
            href="/accounting"
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Chart of Accounts
          </Link>
        }
      />
      {transactions.length === 0 ? (
        <EmptyState message="No journal entries yet." />
      ) : (
        <div className="flex flex-col gap-4">
          {transactions.map((t) => (
            <Card key={t.id} className="p-0">
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">{t.memo}</p>
                  <p className="text-xs text-zinc-500">{formatDate(t.transactionDate)}</p>
                </div>
                <Badge status={t.sourceType} />
              </div>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Account</th>
                    <th className="px-4 py-2 font-medium text-right">Debit</th>
                    <th className="px-4 py-2 font-medium text-right">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {t.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="px-4 py-2 text-zinc-900 dark:text-zinc-50">
                        {l.account.code} · {l.account.name}
                      </td>
                      <td className="px-4 py-2 text-right text-zinc-500">
                        {l.direction === "DEBIT" ? formatCurrency(l.amount.toString()) : ""}
                      </td>
                      <td className="px-4 py-2 text-right text-zinc-500">
                        {l.direction === "CREDIT" ? formatCurrency(l.amount.toString()) : ""}
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
