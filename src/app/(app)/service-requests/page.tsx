import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";

const FILTERS = [
  { key: "open", label: "Open", where: { status: { notIn: ["COMPLETED", "CLOSED", "CANCELLED"] } } },
  { key: "approval", label: "Awaiting approval", where: { status: { in: ["SUBMITTED", "REVIEWED", "QUOTED"] } } },
  { key: "done", label: "Completed / closed", where: { status: { in: ["COMPLETED", "CLOSED"] } } },
  { key: "all", label: "All", where: {} },
] as const;

export default async function ServiceRequestsPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const session = await auth();
  if (!session || !["ADMIN", "SUPERVISOR", "STAFF"].includes(session.user.role)) redirect("/");
  const { f = "open" } = await searchParams;
  const filter = FILTERS.find((x) => x.key === f) ?? FILTERS[0];

  const requests = await prisma.serviceRequest.findMany({
    where: filter.where as object,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { client: true, lines: { include: { service: true } }, assignedTo: true, _count: { select: { jobs: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Service Requests"
        description="What clients have asked for -- each requested service becomes a job once approved"
        action={<ButtonLink href="/service-requests/new">New request</ButtonLink>}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((x) => (
          <Link
            key={x.key}
            href={`/service-requests?f=${x.key}`}
            className={`rounded-full px-3 py-1 text-sm ${x.key === filter.key ? "bg-brand-600 text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800"}`}
          >
            {x.label}
          </Link>
        ))}
      </div>
      {requests.length === 0 ? (
        <EmptyState message="No service requests here yet." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3 font-medium">Request</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Services</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Required by</th>
                <th className="px-4 py-3 font-medium">Assigned</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <Link href={`/service-requests/${r.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
                      {r.requestNumber}
                    </Link>
                    <p className="text-xs text-zinc-500">{formatDate(r.requestDate)}</p>
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{r.client.name}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {r.lines.map((l) => l.service.name).join(", ")}
                    {r._count.jobs > 0 && <span className="ml-1 text-xs text-brand-600">({r._count.jobs} job{r._count.jobs > 1 ? "s" : ""})</span>}
                  </td>
                  <td className="px-4 py-3"><Badge status={r.priority} /></td>
                  <td className="px-4 py-3 text-zinc-500">{formatDate(r.requiredBy)}</td>
                  <td className="px-4 py-3 text-zinc-500">{r.assignedTo?.name ?? "—"}</td>
                  <td className="px-4 py-3"><Badge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
