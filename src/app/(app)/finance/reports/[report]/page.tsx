import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import ReportView from "@/components/ReportView";
import ReportToolbar from "@/components/ReportToolbar";
import { fieldClass } from "@/components/ActionForm";
import { buildReport, defaultPeriod, isReportKey, REPORTS } from "@/lib/finance-reports";
import { endOfDay, isoDate, parseDay } from "@/lib/finance";
import { financeViewer } from "@/lib/finance-access";

type Search = Record<string, string | string[] | undefined>;

export default async function FinanceReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ report: string }>;
  searchParams: Promise<Search>;
}) {
  const { report: key } = await params;
  if (!isReportKey(key)) notFound();
  const meta = REPORTS[key];
  const viewer = await financeViewer();
  if (!(viewer.isManager || (meta.staff && viewer.isStaff))) redirect("/");

  const sp = await searchParams;
  const def = defaultPeriod();
  const from = parseDay(sp.from, def.from);
  const to = endOfDay(parseDay(sp.to, def.to));
  const clientId = typeof sp.client === "string" ? sp.client : undefined;
  const report = await buildReport(key, { from, to, clientId });
  const clients = key === "statement" ? await prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : [];

  const query = new URLSearchParams({ ...(meta.filter === "period" ? { from: isoDate(from) } : {}), to: isoDate(to), ...(clientId ? { client: clientId } : {}) });
  const visible = (Object.keys(REPORTS) as (keyof typeof REPORTS)[]).filter((k) => viewer.isManager || REPORTS[k].staff);

  return (
    <div>
      <PageHeader
        title={report.title}
        description={report.subtitle}
        action={<ReportToolbar exportHref={`/finance/export/${key}?${query}`} />}
      />
      <nav className="mb-4 flex flex-wrap gap-1 print:hidden">
        {visible.map((k) => (
          <Link
            key={k}
            href={`/finance/reports/${k}`}
            className={`rounded-md px-3 py-1.5 text-sm ${k === key ? "bg-brand-600 text-white" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}
          >
            {REPORTS[k].title}
          </Link>
        ))}
      </nav>
      <form className="mb-6 flex flex-wrap items-end gap-3 print:hidden">
        {key === "statement" && (
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
            Client
            <select name="client" defaultValue={clientId ?? ""} className={fieldClass} required>
              <option value="">Choose a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {meta.filter === "period" && (
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
            From
            <input type="date" name="from" defaultValue={isoDate(from)} className={fieldClass} />
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
          {meta.filter === "period" ? "To" : "As of"}
          <input type="date" name="to" defaultValue={isoDate(to)} className={fieldClass} />
        </label>
        <button type="submit" className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
          Show
        </button>
      </form>
      <ReportView report={report} />
    </div>
  );
}
