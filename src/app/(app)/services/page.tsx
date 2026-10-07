import { requirePermission } from "@/lib/session";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ensureServiceCatalog } from "@/lib/catalog";
import { parseDocuments, parseStages, SERVICE_CATEGORIES, SERVICE_CATEGORY_LABELS } from "@/lib/service-templates";
import { Badge, ButtonLink, Card, PageHeader } from "@/components/ui";

export default async function ServicesPage() {
  await requirePermission("catalog.manage");
  await ensureServiceCatalog();

  const [services, jobCounts] = await Promise.all([
    prisma.serviceDefinition.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.job.groupBy({ by: ["serviceId"], _count: { _all: true } }),
  ]);
  const countFor = new Map(jobCounts.map((c) => [c.serviceId, c._count._all]));

  return (
    <div>
      <PageHeader
        title="Service Catalog"
        description="Every service the company offers, with its workflow, document checklist, tasks and turnaround time"
        action={<ButtonLink href="/services/new">New service</ButtonLink>}
      />
      <div className="flex flex-col gap-6">
        {SERVICE_CATEGORIES.map((cat) => {
          const list = services.filter((s) => s.category === cat);
          if (list.length === 0) return null;
          return (
            <Card key={cat} className="p-0">
              <h2 className="border-b border-zinc-200 px-4 py-3 font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
                {SERVICE_CATEGORY_LABELS[cat]}
              </h2>
              <table className="w-full text-left text-sm">
                <thead className="text-zinc-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Service</th>
                    <th className="px-4 py-2 font-medium">Job prefix</th>
                    <th className="px-4 py-2 font-medium">SLA</th>
                    <th className="px-4 py-2 font-medium">Stages</th>
                    <th className="px-4 py-2 font-medium">Documents</th>
                    <th className="px-4 py-2 font-medium">Jobs</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {list.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-2">
                        <Link href={`/services/${s.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
                          {s.name}
                        </Link>
                        <p className="text-xs text-zinc-500">{s.code}</p>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-zinc-500">JOB-{s.jobPrefix}</td>
                      <td className="px-4 py-2 text-zinc-500">{s.slaDays === null ? "—" : s.slaDays === 0 ? "Same day" : `${s.slaDays} days`}</td>
                      <td className="px-4 py-2 text-zinc-500">{parseStages(s.stages).length}</td>
                      <td className="px-4 py-2 text-zinc-500">{parseDocuments(s.documents).length}</td>
                      <td className="px-4 py-2 text-zinc-500">{countFor.get(s.id) ?? 0}</td>
                      <td className="px-4 py-2"><Badge status={s.active ? "ACTIVE" : "INACTIVE"} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
