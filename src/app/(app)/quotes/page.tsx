import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { invoiceTotal } from "@/lib/invoices";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";

export default async function QuotesPage() {
  const quotes = await prisma.quote.findMany({
    orderBy: { issueDate: "desc" },
    include: { client: true, items: true, invoice: true },
  });

  return (
    <div>
      <PageHeader
        title="Quotes"
        description="Send a price before it becomes an invoice"
        action={<ButtonLink href="/quotes/new">New quote</ButtonLink>}
      />
      {quotes.length === 0 ? (
        <EmptyState message="No quotes yet. Create your first quote to get started." />
      ) : (
        <Card className="p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Quote</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Valid until</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {quotes.map((q) => (
                <tr key={q.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/quotes/${q.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {q.quoteNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{q.client.name}</td>
                  <td className="px-4 py-3 text-zinc-500">{formatDate(q.expiryDate)}</td>
                  <td className="px-4 py-3 text-right text-zinc-500">
                    {formatCurrency(invoiceTotal(q.items))}
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={q.status} />
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {q.invoice ? (
                      <Link href={`/invoices/${q.invoice.id}`} className="hover:underline">
                        {q.invoice.invoiceNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
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
