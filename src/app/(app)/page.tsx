import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isFullAccessRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { invoiceBalance } from "@/lib/invoices";
import { financialsOf, jobFinanceSelect } from "@/lib/jobs";
import { summarize } from "@/lib/job-finance";
import { missingRequiredDocuments, slaState } from "@/lib/job-rules";
import { SERVICE_CATEGORIES, SERVICE_CATEGORY_LABELS } from "@/lib/service-templates";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";

// Scoped roles land on their own portal -- this dashboard shows
// company-wide operational and financial data that isn't appropriate for them.
const ROLE_HOME: Record<string, string> = {
  VENDOR: "/my-shipments",
  MINISTRY_OFFICER: "/ministry",
  MINISTRY_REGISTRAR: "/ministries",
  LOGISTICS_STAFF: "/deliveries",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const home = ROLE_HOME[session.user.role];
  if (home) redirect(home);
  const isManager = isFullAccessRole(session.user.role);

  const today = new Date(new Date().setHours(0, 0, 0, 0));
  const yearStart = new Date(today.getFullYear(), 0, 1);

  const [activeJobs, myTasks, awaitingRequests, pendingExpenses, pendingPRs, invoices, balances, activeShipments, yearJobs, followUpsDue, docsExpiring] = await Promise.all([
    prisma.job.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] } },
      include: { client: true, service: true, responsible: true, documents: true },
      orderBy: { dueDate: { sort: "asc", nulls: "last" } },
    }),
    prisma.jobTask.findMany({
      where: { assigneeId: session.user.id, status: { in: ["TODO", "IN_PROGRESS"] }, job: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING", "COMPLETED"] } } },
      include: { job: true },
      orderBy: { dueDate: { sort: "asc", nulls: "last" } },
      take: 10,
    }),
    prisma.serviceRequest.findMany({ where: { status: { in: ["SUBMITTED", "REVIEWED", "QUOTED"] } }, include: { client: true }, orderBy: { createdAt: "asc" }, take: 10 }),
    prisma.expense.findMany({ where: { status: "PENDING_APPROVAL" }, orderBy: { createdAt: "asc" }, take: 10 }),
    prisma.purchaseRequest.count({ where: { status: "PENDING" } }),
    prisma.invoice.findMany({ where: { status: { notIn: ["DRAFT", "CANCELLED"] } }, include: { items: true, payments: true } }),
    prisma.$queryRaw<{ code: string; balance: string; kind: string | null }[]>`
      SELECT ab.code, ab.balance::text AS balance, ma.kind::text AS kind
      FROM account_balances ab LEFT JOIN money_accounts ma ON ma."accountId" = ab.account_id
      WHERE ab.code IN ('1000', '1100', '1200', '2000', '2100', '2200') OR ma.id IS NOT NULL`,
    prisma.shipment.count({ where: { status: { notIn: ["COMPLETED", "CANCELLED"] } } }),
    prisma.job.findMany({
      where: { status: { not: "CANCELLED" }, startDate: { gte: yearStart } },
      include: { service: true, client: true, ...jobFinanceSelect },
    }),
    prisma.jobSubmission.count({
      where: {
        status: { in: ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUIRED"] },
        nextFollowUpAt: { lt: new Date(today.getTime() + 86_400_000) },
        job: { status: { notIn: ["CLOSED", "CANCELLED"] } },
      },
    }),
    prisma.jobDocument.count({
      where: { received: true, expiryDate: { not: null, lt: new Date(today.getTime() + 31 * 86_400_000) }, job: { status: { not: "CANCELLED" } } },
    }),
  ]);

  const bal = (code: string) => Number(balances.find((b) => b.code === code)?.balance ?? 0);
  const cashOnHand = balances.filter((b) => b.kind === "CASH" || (b.code === "1000" && !b.kind)).reduce((s, b) => s + Number(b.balance), 0);
  const bankBalance = balances.filter((b) => b.kind === "BANK" || b.kind === "MOBILE_MONEY").reduce((s, b) => s + Number(b.balance), 0);
  const sla = activeJobs.map((j) => ({ j, s: slaState(j) }));
  const overdue = sla.filter((x) => x.s === "OVERDUE").map((x) => x.j);
  const dueToday = sla.filter((x) => x.s === "DUE_TODAY").map((x) => x.j);
  const docsPending = activeJobs.filter((j) => missingRequiredDocuments(j.documents).length > 0);
  const countCat = (c: string) => activeJobs.filter((j) => j.service.category === c).length;

  const receivable = invoices.reduce((s, i) => s + Math.max(invoiceBalance(i), 0), 0);
  const unpaidCount = invoices.filter((i) => invoiceBalance(i) > 0.005).length;
  const yearRows = yearJobs.map((j) => ({ j, f: financialsOf(j) }));
  const yearTotal = summarize(yearRows.map((r) => r.f));
  const unbilled = yearRows.reduce((s, r) => s + r.f.unbilledBillableCosts + r.f.unbilledMarkup, 0);
  const byService = SERVICE_CATEGORIES.map((c) => ({ c, ...summarize(yearRows.filter((r) => r.j.service.category === c).map((r) => r.f)) })).filter((r) => r.revenue > 0 || r.costs > 0);
  const maxRevenue = Math.max(1, ...byService.map((r) => r.revenue));
  const completedYear = yearJobs.map((j) => slaState(j)).filter((s) => s === "COMPLETED_ON_TIME" || s === "COMPLETED_LATE");
  const onTimePct = completedYear.length ? Math.round((completedYear.filter((s) => s === "COMPLETED_ON_TIME").length / completedYear.length) * 100) : null;
  const clientTotals = new Map<string, { name: string; rows: { invoiced: number; costs: number }[] }>();
  for (const r of yearRows) {
    const e = clientTotals.get(r.j.clientId) ?? { name: r.j.client.name, rows: [] };
    e.rows.push(r.f);
    clientTotals.set(r.j.clientId, e);
  }
  const topClients = [...clientTotals.entries()].map(([id, e]) => ({ id, name: e.name, ...summarize(e.rows) })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  return (
    <div>
      <PageHeader title="Dashboard" description={`Operations and finance at a glance · ${formatDate(new Date())}`} />

      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Operations</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Tile href="/jobs" label="Open jobs" value={activeJobs.length} />
        <Tile href="/jobs?f=today" label="Due today" value={dueToday.length} tone={dueToday.length ? "amber" : undefined} />
        <Tile href="/jobs?f=overdue" label="Overdue jobs" value={overdue.length} tone={overdue.length ? "red" : undefined} />
        <Tile href="/jobs" label="Pending documents" value={docsPending.length} tone={docsPending.length ? "amber" : undefined} />
        <Tile href="/service-requests?f=approval" label="Requests to approve" value={awaitingRequests.length} />
        <Tile href="/shipments" label="Active shipments" value={activeShipments} />
        <Tile href="/cases?t=tax" label="Tax / government cases" value={countCat("GOVERNMENT_TAX")} />
        <Tile href="/cases?t=immigration" label="Immigration cases" value={countCat("IMMIGRATION")} />
        <Tile href="/jobs?cat=VEHICLE" label="Active rentals" value={countCat("VEHICLE")} />
        <Tile href="/jobs?cat=COMMUNICATION" label="Communication requests" value={countCat("COMMUNICATION")} />
        <Tile href="/jobs?cat=LOGISTICS" label="Logistics jobs" value={countCat("LOGISTICS")} />
        <Tile href="/jobs?cat=TRANSPORT" label="Transport jobs" value={countCat("TRANSPORT")} />
        <Tile href="/reminders" label="Follow-ups due" value={followUpsDue} tone={followUpsDue ? "red" : undefined} />
        <Tile href="/reminders" label="Documents expiring (30d)" value={docsExpiring} tone={docsExpiring ? "amber" : undefined} />
      </div>

      {isManager && (
        <>
          <h2 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wide text-zinc-500">Finance</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <StatCard label={`Revenue ${today.getFullYear()}`} value={formatCurrency(yearTotal.revenue)} hint="invoiced on this year's jobs" />
            <StatCard label="Direct costs" value={formatCurrency(yearTotal.costs)} />
            <StatCard label="Gross profit" value={formatCurrency(yearTotal.grossProfit)} hint={yearTotal.marginPercent !== null ? `${yearTotal.marginPercent}% margin` : undefined} />
            <StatCard label="Cash on hand" value={formatCurrency(cashOnHand)} />
            <StatCard label="Bank & mobile money" value={formatCurrency(bankBalance)} />
            <StatCard label="Receivables" value={formatCurrency(receivable)} hint={`${unpaidCount} unpaid invoice${unpaidCount === 1 ? "" : "s"}`} />
            <StatCard label="Payables" value={formatCurrency(bal("2000"))} hint="owed to suppliers" />
            <StatCard label="Client advances" value={formatCurrency(bal("2100"))} hint="deposits not yet used" />
            <StatCard label="Client disbursements" value={formatCurrency(bal("1200"))} hint="paid for clients, to recover" />
            <StatCard label="Not yet billed" value={formatCurrency(unbilled)} hint="billable costs + fees" />
            <StatCard label="SLA on time" value={onTimePct === null ? "—" : `${onTimePct}%`} hint={`${completedYear.length} jobs completed this year`} />
            <StatCard label="Expenses to approve" value={String(pendingExpenses.length)} hint={pendingPRs ? `+ ${pendingPRs} purchase request${pendingPRs > 1 ? "s" : ""}` : undefined} />
          </div>
        </>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Needs attention</h2>
            <Link href="/jobs?f=overdue" className="text-sm text-brand-600 hover:underline">All overdue</Link>
          </div>
          {overdue.length + dueToday.length === 0 ? (
            <EmptyState message="Nothing overdue or due today." />
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
              {[...overdue, ...dueToday].slice(0, 8).map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <Link href={`/jobs/${j.id}`} className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">{j.jobNumber}</Link>
                    <p className="text-xs text-zinc-500">{j.client.name} · {j.service.name} · {j.responsible?.name ?? "unassigned"}</p>
                  </div>
                  <div className="text-right">
                    <Badge status={slaState(j)} />
                    <p className="mt-0.5 text-xs text-zinc-500">due {formatDate(j.dueDate)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">My tasks</h2>
          {myTasks.length === 0 ? (
            <EmptyState message="No open tasks assigned to you." />
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
              {myTasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm text-zinc-900 dark:text-zinc-50">{t.title}</p>
                    <Link href={`/jobs/${t.jobId}`} className="text-xs text-zinc-500 hover:underline">{t.job.jobNumber}</Link>
                  </div>
                  <p className={`text-xs ${t.dueDate && t.dueDate < today ? "font-medium text-red-600" : "text-zinc-500"}`}>due {formatDate(t.dueDate)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {isManager && (
          <Card>
            <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">Revenue &amp; profit by service ({today.getFullYear()})</h2>
            {byService.length === 0 ? (
              <EmptyState message="No invoiced jobs this year yet." />
            ) : (
              <ul className="flex flex-col gap-3">
                {byService.map((r) => (
                  <li key={r.c}>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-700 dark:text-zinc-300">{SERVICE_CATEGORY_LABELS[r.c]}</span>
                      <span className="text-zinc-500">
                        {formatCurrency(r.revenue)} · <span className={r.grossProfit < 0 ? "text-red-600" : "text-emerald-600"}>{formatCurrency(r.grossProfit)}</span>
                        {r.marginPercent !== null && ` (${r.marginPercent}%)`}
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded bg-zinc-100 dark:bg-zinc-800">
                      <div className="h-2 rounded bg-brand-600" style={{ width: `${(r.revenue / maxRevenue) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/reports" className="mt-4 inline-block text-sm text-brand-600 hover:underline">Full profitability report →</Link>
          </Card>
        )}

        {isManager && (
          <Card>
            <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">Top clients ({today.getFullYear()})</h2>
            {topClients.length === 0 ? (
              <EmptyState message="No invoiced jobs this year yet." />
            ) : (
              <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
                {topClients.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                    <Link href={`/clients/${c.id}`} className="text-zinc-900 hover:underline dark:text-zinc-50">{c.name}</Link>
                    <span className="text-zinc-500">
                      {formatCurrency(c.revenue)} · profit {formatCurrency(c.grossProfit)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {awaitingRequests.length > 0 && (
          <Card>
            <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">Service requests awaiting approval</h2>
            <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
              {awaitingRequests.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2">
                  <div>
                    <Link href={`/service-requests/${r.id}`} className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">{r.requestNumber}</Link>
                    <p className="text-xs text-zinc-500">{r.client.name}</p>
                  </div>
                  <Badge status={r.status} />
                </li>
              ))}
            </ul>
          </Card>
        )}

        {isManager && pendingExpenses.length > 0 && (
          <Card>
            <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">Expenses awaiting approval</h2>
            <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
              {pendingExpenses.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2">
                  <Link href={`/expenses/${e.id}`} className="text-sm text-zinc-900 hover:underline dark:text-zinc-50">{e.description}</Link>
                  <span className="text-sm text-zinc-500">{formatCurrency(e.amount.toString())}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

function Tile({ href, label, value, tone }: { href: string; label: string; value: number; tone?: "red" | "amber" }) {
  return (
    <Link href={href} className="rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-brand-500 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : "text-zinc-900 dark:text-zinc-50"}`}>{value}</p>
    </Link>
  );
}
