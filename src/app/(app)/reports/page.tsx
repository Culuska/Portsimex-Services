import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isFullAccessRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { financialsOf, jobFinanceSelect } from "@/lib/jobs";
import { summarize, type ProfitRow } from "@/lib/job-finance";
import { slaState } from "@/lib/job-rules";
import { SERVICE_CATEGORIES, SERVICE_CATEGORY_LABELS } from "@/lib/service-templates";
import { Card, PageHeader, StatCard } from "@/components/ui";

export default async function ProfitabilityPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const session = await auth();
  if (!session || !isFullAccessRole(session.user.role)) redirect("/");
  const { year } = await searchParams;
  const y = year && /^\d{4}$/.test(year) ? Number(year) : null;
  const range = y ? { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) } : undefined;

  const [jobs, unlinked] = await Promise.all([
    prisma.job.findMany({
      where: { status: { not: "CANCELLED" }, ...(range ? { startDate: range } : {}) },
      include: { client: true, service: true, ...jobFinanceSelect },
    }),
    // Revenue billed without a job link (older invoices) -- shown separately
    // so totals reconcile with the invoice register.
    prisma.invoiceItem.findMany({
      where: { jobId: null, invoice: { status: { notIn: ["DRAFT", "CANCELLED"] }, ...(range ? { issueDate: range } : {}) } },
      select: { quantity: true, unitPrice: true },
    }),
  ]);

  const rows = jobs.map((j) => ({ job: j, f: financialsOf(j), sla: slaState(j) }));
  const total = summarize(rows.map((r) => r.f));
  const unlinkedRevenue = unlinked.reduce((s, l) => s + Number(l.quantity) * Number(l.unitPrice), 0);

  const byCategory = SERVICE_CATEGORIES.map((c) => {
    const rs = rows.filter((r) => r.job.service.category === c);
    const done = rs.filter((r) => r.sla === "COMPLETED_ON_TIME" || r.sla === "COMPLETED_LATE");
    return {
      key: c,
      label: SERVICE_CATEGORY_LABELS[c],
      jobs: rs.length,
      ...summarize(rs.map((r) => r.f)),
      onTime: done.filter((r) => r.sla === "COMPLETED_ON_TIME").length,
      completed: done.length,
      overdue: rs.filter((r) => r.sla === "OVERDUE").length,
    };
  }).filter((r) => r.jobs > 0);

  const group = <K extends string>(keyOf: (r: (typeof rows)[number]) => K, labelOf: (r: (typeof rows)[number]) => string) => {
    const map = new Map<K, { label: string; jobs: number; items: (typeof rows)[number]["f"][] }>();
    for (const r of rows) {
      const k = keyOf(r);
      const e = map.get(k) ?? { label: labelOf(r), jobs: 0, items: [] };
      e.jobs += 1;
      e.items.push(r.f);
      map.set(k, e);
    }
    return [...map.entries()]
      .map(([key, e]) => ({ key, label: e.label, jobs: e.jobs, ...summarize(e.items) }))
      .sort((a, b) => b.revenue - a.revenue);
  };
  const byService = group((r) => r.job.serviceId, (r) => r.job.service.name);
  const byClient = group((r) => r.job.clientId, (r) => r.job.client.name);
  const topJobs = [...rows].sort((a, b) => b.f.invoiced - a.f.invoiced).slice(0, 25);
  const years = [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2];

  return (
    <div>
      <PageHeader title="Profitability" description="Revenue, direct cost and gross profit by service, client and job -- computed from each job's invoices and costs" />
      <div className="mb-4 flex flex-wrap gap-2">
        {[null, ...years].map((yy) => (
          <Link
            key={yy ?? "all"}
            href={yy ? `/reports?year=${yy}` : "/reports"}
            className={`rounded-full px-3 py-1 text-sm ${yy === y ? "bg-brand-600 text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800"}`}
          >
            {yy ?? "All time"}
          </Link>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Job revenue (invoiced)" value={formatCurrency(total.revenue)} hint={unlinkedRevenue > 0 ? `+ ${formatCurrency(unlinkedRevenue)} billed without a job` : undefined} />
        <StatCard label="Direct costs" value={formatCurrency(total.costs)} />
        <StatCard label="Gross profit" value={formatCurrency(total.grossProfit)} />
        <StatCard label="Margin" value={total.marginPercent === null ? "—" : `${total.marginPercent}%`} hint={`${rows.length} jobs`} />
      </div>

      <Card className="mb-6 overflow-x-auto p-0">
        <h2 className="border-b border-zinc-200 px-4 py-3 font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">By service line</h2>
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">Service line</th>
              <th className="px-4 py-2 text-right font-medium">Jobs</th>
              <Money />
              <th className="px-4 py-2 text-right font-medium">On time</th>
              <th className="px-4 py-2 text-right font-medium">Overdue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {byCategory.map((r) => (
              <tr key={r.key}>
                <td className="px-4 py-2 font-medium text-zinc-900 dark:text-zinc-50">{r.label}</td>
                <td className="px-4 py-2 text-right">{r.jobs}</td>
                <MoneyCells r={r} />
                <td className="px-4 py-2 text-right text-zinc-500">{r.completed ? `${Math.round((r.onTime / r.completed) * 100)}% of ${r.completed}` : "—"}</td>
                <td className={`px-4 py-2 text-right ${r.overdue ? "font-medium text-red-600" : "text-zinc-500"}`}>{r.overdue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-6">
        <Breakdown title="By client" rows={byClient} hrefOf={(k) => `/clients/${k}`} />
        <Breakdown title="By service" rows={byService} />
      </div>

      <Card className="overflow-x-auto p-0">
        <h2 className="border-b border-zinc-200 px-4 py-3 font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">Job profitability (top 25 by revenue)</h2>
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">Job</th>
              <th className="px-4 py-2 font-medium">Client</th>
              <Money />
              <th className="px-4 py-2 text-right font-medium">Outstanding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {topJobs.map(({ job, f }) => (
              <tr key={job.id}>
                <td className="px-4 py-2">
                  <Link href={`/jobs/${job.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">{job.jobNumber}</Link>
                  <p className="text-xs text-zinc-500">{job.service.name}</p>
                </td>
                <td className="px-4 py-2 text-zinc-500">{job.client.name}</td>
                <MoneyCells r={{ revenue: f.invoiced, costs: f.costs, grossProfit: f.grossProfit, marginPercent: f.marginPercent }} />
                <td className="px-4 py-2 text-right">{formatCurrency(f.outstanding)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Money() {
  return (
    <>
      <th className="px-4 py-2 text-right font-medium">Revenue</th>
      <th className="px-4 py-2 text-right font-medium">Direct cost</th>
      <th className="px-4 py-2 text-right font-medium">Gross profit</th>
      <th className="px-4 py-2 text-right font-medium">Margin</th>
    </>
  );
}

function MoneyCells({ r }: { r: ProfitRow }) {
  return (
    <>
      <td className="px-4 py-2 text-right">{formatCurrency(r.revenue)}</td>
      <td className="px-4 py-2 text-right">{formatCurrency(r.costs)}</td>
      <td className={`px-4 py-2 text-right font-medium ${r.grossProfit < 0 ? "text-red-600" : "text-emerald-600"}`}>{formatCurrency(r.grossProfit)}</td>
      <td className="px-4 py-2 text-right text-zinc-500">{r.marginPercent === null ? "—" : `${r.marginPercent}%`}</td>
    </>
  );
}

function Breakdown({ title, rows, hrefOf }: { title: string; rows: (ProfitRow & { key: string; label: string; jobs: number })[]; hrefOf?: (key: string) => string }) {
  return (
    <Card className="overflow-x-auto p-0">
      <h2 className="border-b border-zinc-200 px-4 py-3 font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">{title}</h2>
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="text-zinc-500">
          <tr>
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 text-right font-medium">Jobs</th>
            <Money />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.slice(0, 20).map((r) => (
            <tr key={r.key}>
              <td className="px-4 py-2">
                {hrefOf ? <Link href={hrefOf(r.key)} className="text-zinc-900 hover:underline dark:text-zinc-50">{r.label}</Link> : r.label}
              </td>
              <td className="px-4 py-2 text-right">{r.jobs}</td>
              <MoneyCells r={r} />
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
