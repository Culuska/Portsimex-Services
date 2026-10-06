import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { currentStage, missingRequiredDocuments, slaState } from "@/lib/job-rules";
import { SERVICE_CATEGORIES, SERVICE_CATEGORY_LABELS, type ServiceCategory } from "@/lib/service-templates";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";

function dayBounds(offsetDays = 0) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + offsetDays);
  const end = new Date(start.getTime() + 86_400_000);
  return { start, end };
}

const ACTIVE: Prisma.EnumJobStatusFilter = { in: ["OPEN", "IN_PROGRESS", "WAITING"] };

function statusFilter(key: string): Prisma.JobWhereInput {
  const today = dayBounds();
  switch (key) {
    case "today":
      return { status: ACTIVE, dueDate: { gte: today.start, lt: today.end } };
    case "overdue":
      return { status: ACTIVE, dueDate: { lt: today.start } };
    case "waiting":
      return { status: "WAITING" };
    case "completed":
      return { status: "COMPLETED" };
    case "closed":
      return { status: "CLOSED" };
    case "cancelled":
      return { status: "CANCELLED" };
    case "all":
      return {};
    default:
      return { status: ACTIVE };
  }
}

const FILTERS = [
  ["active", "Active"],
  ["today", "Due today"],
  ["overdue", "Overdue"],
  ["waiting", "Waiting"],
  ["completed", "Completed (to close)"],
  ["closed", "Closed"],
  ["cancelled", "Cancelled"],
  ["all", "All"],
] as const;

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ f?: string; cat?: string; mine?: string; q?: string }> }) {
  const session = await auth();
  if (!session || !["ADMIN", "SUPERVISOR", "STAFF"].includes(session.user.role)) redirect("/");
  const { f = "active", cat, mine, q } = await searchParams;
  const category = SERVICE_CATEGORIES.includes(cat as ServiceCategory) ? (cat as ServiceCategory) : undefined;

  const where: Prisma.JobWhereInput = {
    ...statusFilter(f),
    ...(category ? { service: { category } } : {}),
    ...(mine ? { responsibleId: session.user.id } : {}),
    ...(q ? { OR: [{ jobNumber: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }, { client: { name: { contains: q, mode: "insensitive" } } }] } : {}),
  };
  const jobs = await prisma.job.findMany({
    where,
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 300,
    include: { client: true, service: true, responsible: true, stages: true, documents: true },
  });

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { f, cat, mine, q, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/jobs?${p.toString()}`;
  };
  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm ${active ? "bg-brand-600 text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800"}`;

  return (
    <div>
      <PageHeader
        title="Jobs / Cases"
        description="Every service the company is delivering, whatever the type -- the link between operations and finance"
        action={<ButtonLink href="/service-requests/new">New service request</ButtonLink>}
      />
      <div className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map(([key, label]) => (
          <Link key={key} href={qs({ f: key })} className={chip(f === key)}>{label}</Link>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={qs({ cat: undefined })} className={chip(!category)}>All services</Link>
        {SERVICE_CATEGORIES.filter((c) => c !== "OTHER").map((c) => (
          <Link key={c} href={qs({ cat: c })} className={chip(category === c)}>{SERVICE_CATEGORY_LABELS[c]}</Link>
        ))}
        <Link href={qs({ mine: mine ? undefined : "1" })} className={chip(!!mine)}>My jobs</Link>
        <form action="/jobs" className="ml-auto flex gap-2">
          <input type="hidden" name="f" value={f} />
          {category && <input type="hidden" name="cat" value={category} />}
          <input name="q" defaultValue={q} placeholder="Search job, title or client" className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
        </form>
      </div>

      {jobs.length === 0 ? (
        <EmptyState message="No jobs match these filters." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Current stage</th>
                <th className="px-4 py-3 font-medium">Responsible</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {jobs.map((j) => {
                const stage = currentStage(j.stages);
                const docsMissing = missingRequiredDocuments(j.documents).length;
                const sla = slaState(j);
                return (
                  <tr key={j.id}>
                    <td className="px-4 py-3">
                      <Link href={`/jobs/${j.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">{j.jobNumber}</Link>
                      <p className="max-w-[240px] truncate text-xs text-zinc-500">{j.title}</p>
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{j.client.name}</td>
                    <td className="px-4 py-3 text-zinc-500">{j.service.name}</td>
                    <td className="px-4 py-3 text-zinc-500">
                      {stage?.name ?? "—"}
                      {docsMissing > 0 && j.status !== "CANCELLED" && (
                        <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">DOCS INCOMPLETE</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{j.responsible?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <p className="text-zinc-500">{formatDate(j.dueDate)}</p>
                      {sla !== "NO_SLA" && sla !== "ON_TRACK" && <Badge status={sla} />}
                    </td>
                    <td className="px-4 py-3"><Badge status={j.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
