import type { Prisma } from "@/generated/prisma/client";
import { audit, type AuditActor } from "@/lib/audit";
import { nextJobNumber } from "@/lib/numbering";
import { computeDueDate } from "@/lib/job-rules";
import { deriveRequestStatus } from "@/lib/request-rules";
import { computeJobFinancials, type BillingType, type InvoiceStatus } from "@/lib/job-finance";
import { parseDocuments, parseStages, parseTasks } from "@/lib/service-templates";

type Tx = Prisma.TransactionClient;
type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

// Creates a Job/Case from a service's template: numbered, with its own
// copy of the workflow stages, document checklist and tasks (so later
// template edits never rewrite a job in progress), and an SLA due date.
export async function createJob(
  tx: Tx,
  actor: AuditActor,
  input: {
    clientId: string;
    serviceId: string;
    title?: string | null;
    description?: string | null;
    priority?: Priority;
    responsibleId?: string | null;
    requiredBy?: Date | null;
    serviceRequestId?: string | null;
    requestLineId?: string | null;
    estimatedRevenue?: number | null;
    estimatedCost?: number | null;
  },
) {
  const service = await tx.serviceDefinition.findUniqueOrThrow({ where: { id: input.serviceId } });
  const client = await tx.client.findUniqueOrThrow({ where: { id: input.clientId }, select: { name: true } });
  const start = new Date();
  const jobNumber = await nextJobNumber(tx, service.jobPrefix);
  const stages = parseStages(service.stages);
  const docs = parseDocuments(service.documents);
  const tasks = parseTasks(service.tasks);

  const job = await tx.job.create({
    data: {
      jobNumber,
      title: input.title?.trim() || `${service.name} — ${client.name}`,
      description: input.description || null,
      priority: input.priority ?? "NORMAL",
      startDate: start,
      dueDate: computeDueDate(start, service.slaDays, input.requiredBy ?? null),
      clientId: input.clientId,
      serviceId: service.id,
      serviceRequestId: input.serviceRequestId ?? null,
      requestLineId: input.requestLineId ?? null,
      responsibleId: input.responsibleId ?? null,
      estimatedRevenue: input.estimatedRevenue ?? null,
      estimatedCost: input.estimatedCost ?? null,
      stages: {
        create: stages.map((s, i) => ({
          position: i,
          name: s.name,
          requiresDocuments: s.requiresDocuments ?? false,
          status: i === 0 ? "IN_PROGRESS" : "PENDING",
          startedAt: i === 0 ? start : null,
        })),
      },
      documents: {
        create: docs.map((d) => ({ name: d.name, required: d.required, isOutput: d.isOutput ?? false })),
      },
      tasks: {
        create: tasks.map((t) => ({
          title: t.title,
          assigneeId: input.responsibleId ?? null,
          priority: input.priority ?? "NORMAL",
          dueDate: t.dueOffsetDays !== undefined ? new Date(start.getTime() + t.dueOffsetDays * 86_400_000) : null,
        })),
      },
    },
  });

  await audit(tx, actor, {
    action: "JOB_CREATED",
    module: "Jobs",
    entityType: "Job",
    entityId: job.id,
    reference: job.jobNumber,
    jobId: job.id,
    message: `Opened ${job.jobNumber} (${service.name}) for ${client.name}.`,
  });
  return job;
}

// Everything needed to compute a job's financials in one query shape.
export const jobFinanceSelect = {
  expenses: {
    select: {
      amount: true,
      status: true,
      billingType: true,
      markupAmount: true,
      invoiceItem: { select: { invoice: { select: { status: true } } } },
    },
  },
  invoiceItems: {
    select: {
      quantity: true,
      unitPrice: true,
      invoice: {
        select: {
          id: true,
          status: true,
          items: { select: { quantity: true, unitPrice: true } },
          payments: { select: { amount: true } },
        },
      },
    },
  },
} satisfies Prisma.JobSelect;

type FinanceShape = Prisma.JobGetPayload<{ select: typeof jobFinanceSelect }>;

export function financialsOf(job: FinanceShape) {
  return computeJobFinancials(
    job.expenses.map((e) => ({
      amount: Number(e.amount),
      status: e.status,
      billingType: e.billingType as BillingType,
      markupAmount: Number(e.markupAmount),
      billedOnInvoiceStatus: (e.invoiceItem?.invoice.status as InvoiceStatus | undefined) ?? null,
    })),
    job.invoiceItems.map((l) => ({
      amount: Number(l.quantity) * Number(l.unitPrice),
      invoiceId: l.invoice.id,
      invoiceStatus: l.invoice.status as InvoiceStatus,
      invoiceTotal: l.invoice.items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0),
      invoicePaid: l.invoice.payments.reduce((s, p) => s + Number(p.amount), 0),
    })),
  );
}

export function detailsOf(raw: unknown): Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

// Keeps a Service Request's status in step with its jobs (in progress ->
// completed -> closed). Call after any job status change.
export async function syncServiceRequestStatus(tx: Tx, serviceRequestId: string | null) {
  if (!serviceRequestId) return;
  const sr = await tx.serviceRequest.findUniqueOrThrow({
    where: { id: serviceRequestId },
    select: { status: true, jobs: { select: { status: true } } },
  });
  const next = deriveRequestStatus(sr.status, sr.jobs.map((j) => j.status));
  if (next && next !== sr.status) {
    await tx.serviceRequest.update({ where: { id: serviceRequestId }, data: { status: next } });
  }
}

// Jobs a new cost or invoice line can be attributed to (anything not yet
// closed or cancelled), labelled for pickers. Optionally narrowed to one client.
export async function attributableJobs(db: Tx | typeof import("@/lib/prisma").prisma, clientId?: string, includeJobId?: string | null) {
  const jobs = await db.job.findMany({
    where: {
      OR: [{ status: { notIn: ["CLOSED", "CANCELLED"] }, ...(clientId ? { clientId } : {}) }, ...(includeJobId ? [{ id: includeJobId }] : [])],
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { id: true, jobNumber: true, title: true, clientId: true, client: { select: { name: true } } },
  });
  return jobs.map((j) => ({ id: j.id, clientId: j.clientId, label: `${j.jobNumber} -- ${j.client.name} -- ${j.title}` }));
}
