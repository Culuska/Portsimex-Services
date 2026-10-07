import { requirePermission } from "@/lib/session";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { Card, EmptyState, PageHeader } from "@/components/ui";

function stamp(d: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ module?: string; q?: string; page?: string }> }) {
  await requirePermission("audit.view");
  const { module, q, page = "1" } = await searchParams;
  const p = Math.max(1, Number(page) || 1);
  const where: Prisma.AuditLogWhereInput = {
    ...(module ? { module } : {}),
    ...(q ? { OR: [{ message: { contains: q, mode: "insensitive" } }, { reference: { contains: q, mode: "insensitive" } }, { actorName: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [rows, modules] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, skip: (p - 1) * 100 }),
    prisma.auditLog.groupBy({ by: ["module"], _count: { _all: true }, orderBy: { module: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="Audit trail" description="Who did what, and when. Records are permanent -- the database rejects any edit or deletion." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/audit" className={`rounded-full px-3 py-1 text-sm ${!module ? "bg-brand-600 text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800"}`}>All</Link>
        {modules.map((m) => (
          <Link
            key={m.module}
            href={`/audit?module=${encodeURIComponent(m.module)}`}
            className={`rounded-full px-3 py-1 text-sm ${module === m.module ? "bg-brand-600 text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800"}`}
          >
            {m.module} <span className="opacity-60">{m._count._all}</span>
          </Link>
        ))}
        <form action="/audit" className="ml-auto">
          {module && <input type="hidden" name="module" value={module} />}
          <input name="q" defaultValue={q} placeholder="Search message, reference or user" className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
        </form>
      </div>
      {rows.length === 0 ? (
        <EmptyState message="No audit records match." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Module</th>
                <th className="px-4 py-3 font-medium">What happened</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-zinc-500">{stamp(r.createdAt)}</td>
                  <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">{r.actorName ?? "System"}</td>
                  <td className="px-4 py-2 text-zinc-500">{r.module}</td>
                  <td className="px-4 py-2 text-zinc-900 dark:text-zinc-50">
                    {r.jobId ? <Link href={`/jobs/${r.jobId}`} className="hover:underline">{r.message}</Link> : r.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <div className="mt-4 flex gap-3 text-sm">
        {p > 1 && <Link href={`/audit?${new URLSearchParams({ ...(module ? { module } : {}), ...(q ? { q } : {}), page: String(p - 1) })}`} className="text-brand-600 hover:underline">← Newer</Link>}
        {rows.length === 100 && <Link href={`/audit?${new URLSearchParams({ ...(module ? { module } : {}), ...(q ? { q } : {}), page: String(p + 1) })}`} className="text-brand-600 hover:underline">Older →</Link>}
      </div>
    </div>
  );
}
