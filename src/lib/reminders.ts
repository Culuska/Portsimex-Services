import { prisma } from "@/lib/prisma";
import { parseFields } from "@/lib/service-templates";
import { detailsOf } from "@/lib/jobs";
import { daysUntil, expiryThreshold, isExpiryField, isoDay } from "@/lib/reminder-rules";
import { formatDate } from "@/lib/format";

type NewNotification = {
  userId: string;
  type: "FOLLOW_UP_DUE" | "DOCUMENT_EXPIRING" | "TASK_OVERDUE" | "JOB_OVERDUE";
  message: string;
  jobId: string;
  dedupeKey: string;
};

let lastRunDay: string | null = null;

// Automatic reminders without a scheduler: the first request of each day
// claims that day's run (an atomic insert into document_counters -- only
// one request can win, even across server instances) and generates the
// day's notifications. Every reminder carries a dedupe key, so re-running
// never notifies anyone twice.
export async function runDailyReminders(now = new Date()) {
  const day = isoDay(now);
  if (lastRunDay === day) return;
  const claimed = await prisma.$queryRaw<{ key: string }[]>`
    INSERT INTO "document_counters" ("key", "value") VALUES (${`REMINDERS-${day}`}, 1)
    ON CONFLICT ("key") DO NOTHING
    RETURNING "key"
  `;
  lastRunDay = day;
  if (claimed.length > 0) await generateReminders(now);
}

export async function generateReminders(now = new Date()) {
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const managers = await prisma.user.findMany({ where: { active: true, role: { in: ["ADMIN", "SUPERVISOR"] } }, select: { id: true } });
  const managerIds = managers.map((m) => m.id);
  const to = (...preferred: (string | null | undefined)[]) => {
    const first = preferred.find((id): id is string => !!id);
    return first ? [first] : managerIds;
  };
  const out: NewNotification[] = [];
  const push = (userIds: string[], n: Omit<NewNotification, "userId" | "dedupeKey">, key: string) => {
    for (const userId of userIds) out.push({ ...n, userId, dedupeKey: `${key}:${userId}` });
  };

  // 1. Government / immigration follow-ups due
  const dueFollowUps = await prisma.jobSubmission.findMany({
    where: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUIRED"] }, nextFollowUpAt: { lt: endOfToday }, job: { status: { notIn: ["CLOSED", "CANCELLED"] } } },
    include: { agency: true, job: { select: { id: true, jobNumber: true, responsibleId: true } } },
  });
  for (const s of dueFollowUps) {
    const when = s.nextFollowUpAt!;
    push(
      to(s.officerId, s.job.responsibleId),
      {
        type: "FOLLOW_UP_DUE",
        jobId: s.job.id,
        message: `Follow up ${s.job.jobNumber} with ${s.agency.name}${s.reference ? ` (ref ${s.reference})` : ""} -- ${when < startOfToday ? `overdue since ${formatDate(when)}` : "due today"}.`,
      },
      `FU:${s.id}:${isoDay(when)}`,
    );
  }

  // 2. Expiring documents (recorded on the checklist) -- including closed
  // jobs, since a visa or certificate expiring after delivery is exactly
  // when the client needs a renewal.
  const expiringDocs = await prisma.jobDocument.findMany({
    where: { received: true, expiryDate: { not: null, lt: new Date(now.getTime() + 31 * 86_400_000) }, job: { status: { not: "CANCELLED" } } },
    include: { job: { select: { id: true, jobNumber: true, responsibleId: true, client: { select: { name: true } } } } },
  });
  for (const d of expiringDocs) {
    const threshold = expiryThreshold(d.expiryDate!, now);
    if (threshold === null) continue;
    const left = daysUntil(d.expiryDate!, now);
    push(
      to(d.job.responsibleId),
      {
        type: "DOCUMENT_EXPIRING",
        jobId: d.job.id,
        message: `${d.name} for ${d.job.client.name} (${d.job.jobNumber}) ${left < 0 ? "expired on" : left === 0 ? "expires today," : "expires on"} ${formatDate(d.expiryDate)}.`,
      },
      `EXP:${d.id}:${threshold}`,
    );
  }

  // 3. Expiry dates held in service fields (passport expiry, permit expiry...)
  // -- skipping any that merely repeat a checklist document's expiry (the
  // output's expiry is copied into the case fields), so nobody is told twice.
  const docExpiries = new Set(
    (await prisma.jobDocument.findMany({ where: { received: true, expiryDate: { not: null } }, select: { jobId: true, expiryDate: true } })).map(
      (d) => `${d.jobId}:${isoDay(d.expiryDate!)}`,
    ),
  );
  const jobsWithDates = await prisma.job.findMany({
    where: { status: { not: "CANCELLED" } },
    select: { id: true, jobNumber: true, responsibleId: true, details: true, client: { select: { name: true } }, service: { select: { fields: true } } },
  });
  for (const j of jobsWithDates) {
    const details = detailsOf(j.details);
    for (const f of parseFields(j.service.fields).filter(isExpiryField)) {
      const raw = details[f.key];
      if (typeof raw !== "string" || !raw) continue;
      const date = new Date(raw);
      if (Number.isNaN(date.getTime()) || docExpiries.has(`${j.id}:${isoDay(date)}`)) continue;
      const threshold = expiryThreshold(date, now);
      if (threshold === null) continue;
      const left = daysUntil(date, now);
      push(
        to(j.responsibleId),
        {
          type: "DOCUMENT_EXPIRING",
          jobId: j.id,
          message: `${f.label} for ${j.client.name} (${j.jobNumber}) ${left < 0 ? "expired on" : "is"} ${left < 0 ? formatDate(date) : left === 0 ? "today" : `on ${formatDate(date)}`}.`,
        },
        `EXPF:${j.id}:${f.key}:${raw}:${threshold}`,
      );
    }
  }

  // 4. Overdue tasks
  const lateTasks = await prisma.jobTask.findMany({
    where: { status: { in: ["TODO", "IN_PROGRESS"] }, dueDate: { lt: startOfToday }, job: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING", "COMPLETED"] } } },
    include: { job: { select: { id: true, jobNumber: true, responsibleId: true } } },
  });
  for (const t of lateTasks) {
    push(to(t.assigneeId, t.job.responsibleId), { type: "TASK_OVERDUE", jobId: t.job.id, message: `Task "${t.title}" on ${t.job.jobNumber} is overdue (due ${formatDate(t.dueDate)}).` }, `TASK:${t.id}:${isoDay(t.dueDate!)}`);
  }

  // 5. Jobs past their SLA due date
  const lateJobs = await prisma.job.findMany({
    where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] }, dueDate: { lt: startOfToday } },
    select: { id: true, jobNumber: true, responsibleId: true, dueDate: true, client: { select: { name: true } } },
  });
  for (const j of lateJobs) {
    push(to(j.responsibleId), { type: "JOB_OVERDUE", jobId: j.id, message: `${j.jobNumber} for ${j.client.name} is past its due date (${formatDate(j.dueDate)}).` }, `SLA:${j.id}:${isoDay(j.dueDate!)}`);
  }

  if (out.length > 0) await prisma.notification.createMany({ data: out, skipDuplicates: true });
  return out.length;
}
