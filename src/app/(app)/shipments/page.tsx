import Link from "next/link";
import { auth } from "@/auth";
import { isFullAccessRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

const TYPE_LABELS: Record<string, string> = {
  IMPORT: "Import",
  EXPORT: "Export",
  TRANSSHIPMENT: "Transshipment",
  DOMESTIC: "Domestic",
  CUSTOMS_CLEARANCE: "Customs clearance",
};

export default async function ShipmentsPage() {
  const [session, shipments, pendingQuotes] = await Promise.all([
    auth(),
    prisma.shipment.findMany({
      orderBy: { createdAt: "desc" },
      include: { client: true, assignee: true },
    }),
    // Quotes on their way to becoming a shipment: sent (awaiting the
    // client) or accepted (awaiting an admin to start it) but not yet
    // claimed by a shipment.
    prisma.quote.findMany({
      where: { status: { in: ["SENT", "ACCEPTED"] }, shipmentId: null },
      include: { client: true },
      orderBy: { issueDate: "desc" },
    }),
  ]);

  const isAdmin = !!session && isFullAccessRole(session.user.role);

  return (
    <div>
      <PageHeader
        title="Shipments"
        description="Operational jobs — imports, exports, and transshipments"
        action={
          <Link
            href="/quotes"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Start from an accepted quote
          </Link>
        }
      />

      {pendingQuotes.length > 0 && (
        <Card className="mb-6 p-0">
          <h2 className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-50">
            Pending shipments
          </h2>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Quote</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {pendingQuotes.map((q) => (
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
                  <td className="px-4 py-3 text-zinc-500">
                    {TYPE_LABELS[q.type] ?? q.type}
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={q.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {q.status === "ACCEPTED" ? (
                      isAdmin ? (
                        <Link
                          href={`/shipments/new?quoteId=${q.id}`}
                          className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                        >
                          Start shipment
                        </Link>
                      ) : (
                        <span className="text-xs text-zinc-400">Awaiting admin</span>
                      )
                    ) : (
                      <span className="text-xs text-zinc-400">Awaiting client</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {shipments.length === 0 ? (
        <EmptyState message="No shipments yet. A shipment starts from an accepted quote -- open one on the Quotes page and use &quot;Start shipment&quot;." />
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
                    <p className="text-xs text-zinc-500">{TYPE_LABELS[s.type] ?? s.type}</p>
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
