import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";

export default async function ShipmentsPage() {
  const shipments = await prisma.shipment.findMany({
    orderBy: { createdAt: "desc" },
    include: { client: true, assignee: true },
  });

  return (
    <div>
      <PageHeader
        title="Shipments"
        description="Operational jobs — imports, exports, and transshipments"
        action={<ButtonLink href="/shipments/new">New shipment</ButtonLink>}
      />
      {shipments.length === 0 ? (
        <EmptyState message="No shipments yet. Create your first job to get started." />
      ) : (
        <Card className="p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Route</th>
                <th className="px-4 py-3 font-medium">Assignee</th>
                <th className="px-4 py-3 font-medium">ETA</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {shipments.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/shipments/${s.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {s.reference}
                    </Link>
                    <p className="text-xs text-zinc-500">{s.type}</p>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{s.client.name}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {s.origin} → {s.destination}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {s.assignee?.name ?? "Unassigned"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{formatDate(s.eta)}</td>
                  <td className="px-4 py-3">
                    <Badge status={s.status} />
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
