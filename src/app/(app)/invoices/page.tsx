import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { invoiceBalance, invoiceTotal } from "@/lib/invoices";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";

export default async function InvoicesPage() {
  const invoices = await prisma.invoice.findMany({
    orderBy: { issueDate: "desc" },
    include: { client: true, items: true, payments: true },
  });

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Bill clients and track payments"
        action={<ButtonLink href="/invoices/new">New invoice</ButtonLink>}
      />
      {invoices.length === 0 ? (
        <EmptyState message="No invoices yet. Create your first invoice to get started." />
      ) : (
        <Card className="p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Balance</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {inv.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{inv.client.name}</td>
                  <td className="px-4 py-3 text-zinc-500">{formatDate(inv.dueDate)}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {formatCurrency(invoiceTotal(inv.items))}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {formatCurrency(Math.max(invoiceBalance(inv.items, inv.payments), 0))}
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={inv.status} />
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
