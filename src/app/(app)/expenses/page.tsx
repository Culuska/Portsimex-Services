import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";

export default async function ExpensesPage() {
  const expenses = await prisma.expense.findMany({
    orderBy: { incurredAt: "desc" },
    include: { category: true, vendor: true, shipment: true },
  });

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Track operational costs by category, vendor, and job"
        action={<ButtonLink href="/expenses/new">New expense</ButtonLink>}
      />
      {expenses.length === 0 ? (
        <EmptyState message="No expenses yet. Record your first expense to get started." />
      ) : (
        <Card className="p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Shipment</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/expenses/${e.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {e.description}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{e.category.name}</td>
                  <td className="px-4 py-3 text-zinc-500">{e.vendor?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {e.shipment?.reference ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{formatDate(e.incurredAt)}</td>
                  <td className="px-4 py-3 text-right text-zinc-500">
                    {formatCurrency(e.amount.toString())}
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={e.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
