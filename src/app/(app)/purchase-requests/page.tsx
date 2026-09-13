import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";

export default async function PurchaseRequestsPage() {
  const requests = await prisma.purchaseRequest.findMany({
    orderBy: { requestedAt: "desc" },
    include: { category: true, requestedBy: true, vendor: true },
  });

  return (
    <div>
      <PageHeader
        title="Purchase Requests"
        description="Request spending approval before it becomes an expense"
        action={<ButtonLink href="/purchase-requests/new">New request</ButtonLink>}
      />
      {requests.length === 0 ? (
        <EmptyState message="No purchase requests yet." />
      ) : (
        <Card className="p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Request</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Requested by</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {requests.map((pr) => (
                <tr key={pr.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/purchase-requests/${pr.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {pr.requestNumber}
                    </Link>
                    <p className="text-xs text-zinc-500">{pr.description}</p>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{pr.category.name}</td>
                  <td className="px-4 py-3 text-zinc-500">{pr.vendor?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-500">{pr.requestedBy.name}</td>
                  <td className="px-4 py-3 text-zinc-500">{formatDate(pr.requestedAt)}</td>
                  <td className="px-4 py-3 text-right text-zinc-500">
                    {formatCurrency(pr.amount.toString())}
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={pr.status} />
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
