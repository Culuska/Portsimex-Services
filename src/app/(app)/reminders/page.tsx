import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isFullAccessRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { detailsOf } from "@/lib/jobs";
import { parseFields } from "@/lib/service-templates";
import { daysUntil, expiryState, isExpiryField, isoDay } from "@/lib/reminder-rules";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import SimpleActionButton from "@/components/SimpleActionButton";
import { sendRemindersNowAction } from "./actions";

function when(days: number) {
  if (days < 0) return { text: `${-days} day${days === -1 ? "" : "s"} overdue`, tone: "text-red-600 font-semibold" };
  if (days === 0) return { text: "today", tone: "text-orange-600 font-semibold" };
  return { text: `in ${days} day${days === 1 ? "" : "s"}`, tone: "text-zinc-500" };
}

export default async function RemindersPage({ searchParams }: { searchParams: Promise<{ mine?: string }> }) {
  const session = await auth();
  if (!session || !["ADMIN", "SUPERVISOR", "STAFF"].includes(session.user.role)) redirect("/");
  const { mine } = await searchParams;
  const me = session.user.id;
  const now = new Date();
  const horizon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 8);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [followUps, docs, jobsWithFields, tasks] = await Promise.all([
    prisma.jobSubmission.findMany({
      where: {
        status: { in: ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUIRED"] },
        nextFollowUpAt: { lt: horizon },
        job: { status: { notIn: ["CLOSED", "CANCELLED"] } },
        ...(mine ? { OR: [{ officerId: me }, { job: { responsibleId: me } }] } : {}),
      },
      orderBy: { nextFollowUpAt: "asc" },
      include: { agency: true, officer: true, job: { include: { client: true } } },
    }),
    prisma.jobDocument.findMany({
      where: {
        received: true,
        expiryDate: { not: null, lt: new Date(now.getTime() + 61 * 86_400_000) },
        job: { status: { not: "CANCELLED" }, ...(mine ? { responsibleId: me } : {}) },
      },
      orderBy: { expiryDate: "asc" },
      include: { job: { include: { client: true } } },
    }),
    prisma.job.findMany({
      where: { status: { not: "CANCELLED" }, ...(mine ? { responsibleId: me } : {}) },
      select: { id: true, jobNumber: true, details: true, client: { select: { name: true } }, service: { select: { fields: true } } },
    }),
    prisma.jobTask.findMany({
      where: {
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueDate: { lt: today },
        job: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING", "COMPLETED"] } },
        ...(mine ? { assigneeId: me } : {}),
      },
      orderBy: { dueDate: "asc" },
      include: { assignee: true, job: true },
      take: 100,
    }),
  ]);

  // Field dates that just repeat a checklist document's expiry are shown once.
  const docExpiryKeys = new Set(docs.map((d) => `${d.jobId}:${isoDay(d.expiryDate!)}`));
  const fieldExpiries = jobsWithFields.flatMap((j) => {
    const d = detailsOf(j.details);
    return parseFields(j.service.fields)
      .filter(isExpiryField)
      .flatMap((f) => {
        const raw = d[f.key];
        if (typeof raw !== "string" || !raw) return [];
        const date = new Date(raw);
        if (Number.isNaN(date.getTime()) || daysUntil(date, now) > 60 || docExpiryKeys.has(`${j.id}:${isoDay(date)}`)) return [];
        return [{ key: `${j.id}-${f.key}`, label: f.label, date, jobId: j.id, jobNumber: j.jobNumber, client: j.client.name }];
      });
  });
  const expiries = [
    ...docs.map((d) => ({ key: d.id, label: d.name, date: d.expiryDate!, jobId: d.jobId, jobNumber: d.job.jobNumber, client: d.job.client.name, reference: d.reference })),
    ...fieldExpiries.map((f) => ({ ...f, reference: null as string | null })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div>
      <PageHeader
        title="Follow-ups & Alerts"
        description="Ministry and immigration follow-ups due, documents about to expire, and overdue tasks. Reminders are also sent automatically as notifications each day."
        action={
          <div className="flex items-center gap-3">
            <Link href={mine ? "/reminders" : "/reminders?mine=1"} className="text-sm text-brand-600 hover:underline">{mine ? "Show everyone's" : "Show only mine"}</Link>
            {isFullAccessRole(session.user.role) && <SimpleActionButton action={sendRemindersNowAction} label="Send reminders now" />}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">Follow-ups due (next 7 days)</h2>
          {followUps.length === 0 ? (
            <EmptyState message="No follow-ups due." />
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
              {followUps.map((s) => {
                const w = when(daysUntil(s.nextFollowUpAt!, now));
                return (
                  <li key={s.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div>
                      <Link href={`/jobs/${s.jobId}`} className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">{s.job.jobNumber}</Link>
                      <span className="ml-2 text-xs text-zinc-500">{s.job.client.name}</span>
                      <p className="text-xs text-zinc-500">
                        {s.agency.name}
                        {s.reference ? ` · ref ${s.reference}` : ""} · {s.officer?.name ?? "no officer"}
                        {s.nextAction ? ` · ${s.nextAction}` : ""}
                      </p>
                    </div>
                    <div className="text-right text-xs">
                      <p className={w.tone}>{w.text}</p>
                      <p className="text-zinc-400">{formatDate(s.nextFollowUpAt)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">Documents expiring (next 60 days)</h2>
          {expiries.length === 0 ? (
            <EmptyState message="Nothing expiring soon." />
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
              {expiries.map((e) => {
                const state = expiryState(e.date, now);
                const left = daysUntil(e.date, now);
                return (
                  <li key={e.key} className="flex items-start justify-between gap-3 py-2.5">
                    <div>
                      <p className="text-sm text-zinc-900 dark:text-zinc-50">
                        {e.label}
                        {e.reference && <span className="ml-1 text-xs text-zinc-500">({e.reference})</span>}
                      </p>
                      <p className="text-xs text-zinc-500">
                        <Link href={`/jobs/${e.jobId}`} className="hover:underline">{e.jobNumber}</Link> · {e.client}
                      </p>
                    </div>
                    <div className="text-right text-xs">
                      <p className={state === "EXPIRED" ? "font-semibold text-red-600" : state === "EXPIRES_SOON" ? "font-semibold text-amber-600" : "text-zinc-500"}>
                        {left < 0 ? `expired ${-left}d ago` : left === 0 ? "expires today" : `in ${left} days`}
                      </p>
                      <p className="text-zinc-400">{formatDate(e.date)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">Overdue tasks</h2>
          {tasks.length === 0 ? (
            <EmptyState message="No overdue tasks." />
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm text-zinc-900 dark:text-zinc-50">{t.title}</p>
                    <p className="text-xs text-zinc-500">
                      <Link href={`/jobs/${t.jobId}`} className="hover:underline">{t.job.jobNumber}</Link> · {t.assignee?.name ?? "unassigned"}
                    </p>
                  </div>
                  <p className="text-xs font-semibold text-red-600">due {formatDate(t.dueDate)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
