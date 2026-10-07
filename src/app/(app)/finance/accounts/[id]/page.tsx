import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { MONEY_ACCOUNT_KIND_LABELS } from "@/lib/finance";
import { financeViewer } from "@/lib/finance-access";

const SOURCE_LABELS: Record<string, string> = {
  INVOICE_PAYMENT: "Client payment",
  ADVANCE_RECEIPT: "Client advance",
  ADVANCE_REFUND: "Refund to client",
  SUPPLIER_PAYMENT: "Supplier payment",
  EXPENSE_PAYOUT: "Expense paid",
  TRANSFER: "Transfer",
  MANUAL: "Journal entry",
};

// Account register: every movement on one cash box / bank account, with a running balance.
export default async function MoneyAccountPage({ params }: { params: Promise<{ id: string }> }) {
  await financeViewer("finance.banking", "reports.financial");
  const { id } = await params;
  const account = await prisma.moneyAccount.findUnique({ where: { id }, include: { account: true } });
  if (!account) notFound();

  const lines = await prisma.ledgerLine.findMany({
    where: { accountId: account.accountId },
    include: { transaction: true },
    orderBy: [{ transaction: { transactionDate: "asc" } }, { transaction: { createdAt: "asc" } }],
  });
  const rows = lines.reduce<{ l: (typeof lines)[number]; amount: number; balance: number }[]>((acc, l) => {
    const amount = Number(l.amount) * (l.direction === "DEBIT" ? 1 : -1);
    const previous = acc.length ? acc[acc.length - 1].balance : 0;
    acc.push({ l, amount, balance: Math.round((previous + amount) * 100) / 100 });
    return acc;
  }, []);
  const running = rows.length ? rows[rows.length - 1].balance : 0;

  return (
    <div>
      <PageHeader
        title={account.name}
        description={`${MONEY_ACCOUNT_KIND_LABELS[account.kind]}${account.bankName ? ` · ${account.bankName}` : ""}${account.accountNumber ? ` · ${account.accountNumber}` : ""} · ledger account ${account.account.code} · ${account.currency}`}
        action={
          <p className="text-2xl font-semibold tabular-nums">{formatCurrency(running)}</p>
        }
      />
      <p className="mb-4 text-sm">
        <Link href="/finance" className="text-brand-600 hover:underline">
          ← Finance
        </Link>
      </p>
      {rows.length === 0 ? (
        <EmptyState message="No money has moved through this account yet." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Details</th>
                <th className="px-4 py-2 text-right font-medium">In</th>
                <th className="px-4 py-2 text-right font-medium">Out</th>
                <th className="px-4 py-2 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {[...rows].reverse().map(({ l, amount, balance }) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-zinc-500">{formatDate(l.transaction.transactionDate)}</td>
                  <td className="px-4 py-2 text-zinc-500">{SOURCE_LABELS[l.transaction.sourceType] ?? l.transaction.sourceType.replace(/_/g, " ").toLowerCase()}</td>
                  <td className="px-4 py-2">{l.transaction.memo}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{amount > 0 ? formatCurrency(amount) : ""}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{amount < 0 ? formatCurrency(-amount) : ""}</td>
                  <td className={`px-4 py-2 text-right font-medium tabular-nums ${balance < 0 ? "text-red-600" : ""}`}>{formatCurrency(balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
