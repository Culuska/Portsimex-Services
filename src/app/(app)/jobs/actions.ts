"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { isFullAccessRole } from "@/lib/roles";
import { audit } from "@/lib/audit";
import { uploadJobFile } from "@/lib/blob";
import { nextInvoiceNumber } from "@/lib/numbering";
import { detailsOf, financialsOf, jobFinanceSelect, syncServiceRequestStatus } from "@/lib/jobs";
import { isExpenseBilled, type InvoiceStatus } from "@/lib/job-finance";
import {
  assertJobTransition,
  checkCompleteStage,
  closureBlockers,
  completionBlockers,
  currentStage,
  isJobActive,
  JobRuleError,
} from "@/lib/job-rules";
import { parseFields } from "@/lib/service-templates";

type State = { error: string | null };
const ok: State = { error: null };

function refresh(jobId: string) {
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
}

async function loadJob(jobId: string) {
  return prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    include: { stages: true, documents: true, service: true },
  });
}

// ---------------------------------------------------------------------------
// Job status
// ---------------------------------------------------------------------------

type Move = "START" | "WAIT" | "RESUME" | "COMPLETE" | "CLOSE" | "REOPEN";
const MOVE_TARGET = {
  START: "IN_PROGRESS",
  WAIT: "WAITING",
  RESUME: "IN_PROGRESS",
  COMPLETE: "COMPLETED",
  CLOSE: "CLOSED",
  REOPEN: "IN_PROGRESS",
} as const;
const MANAGER_MOVES: Move[] = ["CLOSE", "REOPEN"];

export async function moveJobAction(jobId: string, move: Move): Promise<State> {
  const user = await requireStaff();
  if (MANAGER_MOVES.includes(move) && !isFullAccessRole(user.role)) return { error: "Only a manager can do that." };
  const job = await prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    include: { stages: true, documents: true, service: true, ...jobFinanceSelect },
  });
  const to = MOVE_TARGET[move];
  try {
    assertJobTransition(job.status, to);
  } catch (e) {
    return { error: e instanceof JobRuleError ? e.message : "Not allowed." };
  }

  if (move === "COMPLETE") {
    const blockers = completionBlockers({
      status: job.status,
      stages: job.stages,
      docs: job.documents,
      reconcile: job.service.reconcileQuantities,
      details: detailsOf(job.details),
    });
    if (blockers.length > 0) return { error: `Can't complete yet: ${blockers.join(" ")}` };
  }
  if (move === "CLOSE") {
    const f = financialsOf(job);
    const blockers = closureBlockers({
      status: job.status,
      unbilledBillableCosts: f.unbilledBillableCosts,
      invoicedTotal: f.invoiced,
      outstanding: f.outstanding,
      draftInvoiceLines: f.draftLines,
    });
    if (blockers.length > 0) return { error: `Can't close yet: ${blockers.join(" ")}` };
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.job.update({
      where: { id: jobId },
      data: {
        status: to,
        completedAt: move === "COMPLETE" ? now : move === "REOPEN" ? null : undefined,
        closedAt: move === "CLOSE" ? now : undefined,
      },
    });
    await audit(tx, user, {
      action: `JOB_${move}`,
      module: "Jobs",
      entityType: "Job",
      entityId: jobId,
      reference: job.jobNumber,
      jobId,
      message: `${job.jobNumber} moved from ${job.status} to ${to}.`,
    });
    await syncServiceRequestStatus(tx, job.serviceRequestId);
  });
  refresh(jobId);
  return ok;
}

const cancelSchema = z.object({ reason: z.string().trim().min(3, "Give a reason for cancelling") });

export async function cancelJobAction(jobId: string, _prev: State, formData: FormData): Promise<State> {
  const user = await requireStaff();
  if (!isFullAccessRole(user.role)) return { error: "Only a manager can cancel a job." };
  const parsed = cancelSchema.safeParse({ reason: formData.get("reason") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId }, include: jobFinanceSelect });
  try {
    assertJobTransition(job.status, "CANCELLED");
  } catch (e) {
    return { error: e instanceof JobRuleError ? e.message : "Not allowed." };
  }
  if (financialsOf(job).invoiced > 0) return { error: "This job has already been invoiced -- it can't be cancelled." };

  await prisma.$transaction(async (tx) => {
    await tx.job.update({ where: { id: jobId }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: parsed.data.reason } });
    await tx.jobTask.updateMany({ where: { jobId, status: { in: ["TODO", "IN_PROGRESS"] } }, data: { status: "CANCELLED" } });
    await audit(tx, user, {
      action: "JOB_CANCELLED",
      module: "Jobs",
      entityType: "Job",
      entityId: jobId,
      reference: job.jobNumber,
      jobId,
      message: `${job.jobNumber} cancelled: ${parsed.data.reason}`,
    });
    await syncServiceRequestStatus(tx, job.serviceRequestId);
  });
  refresh(jobId);
  return ok;
}

// ---------------------------------------------------------------------------
// Workflow stages
// ---------------------------------------------------------------------------

export async function completeStageAction(jobId: string, stageId: string, _prev: State, formData: FormData): Promise<State> {
  const user = await requireStaff();
  const job = await loadJob(jobId);
  const stage = job.stages.find((s) => s.id === stageId);
  if (!stage) return { error: "Stage not found." };
  const blocker = checkCompleteStage(stage, job.stages, job.documents, job.status);
  if (blocker) return { error: blocker };
  const note = String(formData.get("note") ?? "").trim() || null;
  await advanceStage(job, stage, "DONE", user, note);
  refresh(jobId);
  return ok;
}

export async function skipStageAction(jobId: string, stageId: string): Promise<State> {
  const user = await requireStaff();
  if (!isFullAccessRole(user.role)) return { error: "Only a manager can skip a stage." };
  const job = await loadJob(jobId);
  const stage = job.stages.find((s) => s.id === stageId);
  if (!stage) return { error: "Stage not found." };
  if (!isJobActive(job.status)) return { error: "Reopen the job first." };
  if (currentStage(job.stages)?.id !== stage.id) return { error: "Only the current stage can be skipped." };
  await advanceStage(job, stage, "SKIPPED", user, "Skipped by manager");
  refresh(jobId);
  return ok;
}

async function advanceStage(
  job: Awaited<ReturnType<typeof loadJob>>,
  stage: { id: string; position: number; name: string },
  outcome: "DONE" | "SKIPPED",
  user: { id: string; name?: string | null },
  note: string | null,
) {
  const now = new Date();
  const next = [...job.stages].sort((a, b) => a.position - b.position).find((s) => s.position > stage.position && s.status === "PENDING");
  await prisma.$transaction(async (tx) => {
    await tx.jobStage.update({ where: { id: stage.id }, data: { status: outcome, completedAt: now, completedById: user.id, note } });
    if (next) await tx.jobStage.update({ where: { id: next.id }, data: { status: "IN_PROGRESS", startedAt: now } });
    if (job.status === "OPEN") await tx.job.update({ where: { id: job.id }, data: { status: "IN_PROGRESS" } });
    await audit(tx, user, {
      action: outcome === "DONE" ? "JOB_STAGE_COMPLETED" : "JOB_STAGE_SKIPPED",
      module: "Jobs",
      entityType: "Job",
      entityId: job.id,
      reference: job.jobNumber,
      jobId: job.id,
      message: `${job.jobNumber}: stage "${stage.name}" ${outcome === "DONE" ? "completed" : "skipped"}${note && outcome === "DONE" ? ` -- ${note}` : ""}.`,
    });
    if (job.status === "OPEN") await syncServiceRequestStatus(tx, job.serviceRequestId);
  });
}

// ---------------------------------------------------------------------------
// Document checklist
// ---------------------------------------------------------------------------

export async function receiveDocumentAction(jobId: string, docId: string, _prev: State, formData: FormData): Promise<State> {
  const user = await requireStaff();
  const job = await loadJob(jobId);
  const doc = job.documents.find((d) => d.id === docId);
  if (!doc) return { error: "Document not found." };
  if (!isJobActive(job.status) && job.status !== "COMPLETED") return { error: `The job is ${job.status.toLowerCase()}.` };

  let upload: { url: string; fileName: string } | null = null;
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > 4 * 1024 * 1024) return { error: "Files must be 4 MB or smaller -- scan at a lower resolution or split the document." };
    try {
      upload = await uploadJobFile(file, jobId);
    } catch {
      return { error: "The file couldn't be uploaded (file storage isn't configured). Record it as received without a file, or try again later." };
    }
  }
  const reference = String(formData.get("reference") ?? "").trim() || null;
  const expiry = String(formData.get("expiryDate") ?? "");

  await prisma.$transaction(async (tx) => {
    await tx.jobDocument.update({
      where: { id: docId },
      data: {
        received: true,
        receivedAt: new Date(),
        receivedById: user.id,
        reference: reference ?? doc.reference,
        expiryDate: expiry ? new Date(expiry) : doc.expiryDate,
        fileUrl: upload?.url ?? doc.fileUrl,
        fileName: upload?.fileName ?? doc.fileName,
      },
    });
    await audit(tx, user, {
      action: "JOB_DOCUMENT_RECEIVED",
      module: "Jobs",
      entityType: "Job",
      entityId: jobId,
      reference: job.jobNumber,
      jobId,
      message: `${job.jobNumber}: "${doc.name}" received${upload ? ` (file ${upload.fileName})` : ""}${reference ? `, ref ${reference}` : ""}.`,
    });
  });
  refresh(jobId);
  return ok;
}

export async function unreceiveDocumentAction(jobId: string, docId: string): Promise<State> {
  const user = await requireStaff();
  const job = await loadJob(jobId);
  const doc = job.documents.find((d) => d.id === docId);
  if (!doc) return { error: "Document not found." };
  if (!isJobActive(job.status)) return { error: `The job is ${job.status.toLowerCase()}.` };
  await prisma.$transaction(async (tx) => {
    await tx.jobDocument.update({ where: { id: docId }, data: { received: false, receivedAt: null, receivedById: null } });
    await audit(tx, user, {
      action: "JOB_DOCUMENT_UNMARKED",
      module: "Jobs",
      entityType: "Job",
      entityId: jobId,
      reference: job.jobNumber,
      jobId,
      message: `${job.jobNumber}: "${doc.name}" marked as not received.`,
    });
  });
  refresh(jobId);
  return ok;
}

const addDocSchema = z.object({ name: z.string().trim().min(1, "Document name is required"), required: z.boolean() });

export async function addDocumentAction(jobId: string, _prev: State, formData: FormData): Promise<State> {
  const user = await requireStaff();
  const parsed = addDocSchema.safeParse({ name: formData.get("name") ?? "", required: formData.get("required") === "on" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const job = await loadJob(jobId);
  if (!isJobActive(job.status)) return { error: `The job is ${job.status.toLowerCase()}.` };
  await prisma.$transaction(async (tx) => {
    await tx.jobDocument.create({ data: { jobId, name: parsed.data.name, required: parsed.data.required } });
    await audit(tx, user, {
      action: "JOB_DOCUMENT_ADDED",
      module: "Jobs",
      entityType: "Job",
      entityId: jobId,
      reference: job.jobNumber,
      jobId,
      message: `${job.jobNumber}: added "${parsed.data.name}" to the checklist${parsed.data.required ? " (required)" : ""}.`,
    });
  });
  refresh(jobId);
  return ok;
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

const taskSchema = z.object({
  title: z.string().trim().min(1, "Task title is required"),
  assigneeId: z.string(),
  dueDate: z.string(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
});

export async function addTaskAction(jobId: string, _prev: State, formData: FormData): Promise<State> {
  const user = await requireStaff();
  const parsed = taskSchema.safeParse({
    title: formData.get("title") ?? "",
    assigneeId: formData.get("assigneeId") ?? "",
    dueDate: formData.get("dueDate") ?? "",
    priority: formData.get("priority") ?? "NORMAL",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
  if (!isJobActive(job.status) && job.status !== "COMPLETED") return { error: `The job is ${job.status.toLowerCase()}.` };
  await prisma.$transaction(async (tx) => {
    await tx.jobTask.create({
      data: {
        jobId,
        title: parsed.data.title,
        assigneeId: parsed.data.assigneeId || null,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        priority: parsed.data.priority,
      },
    });
    await audit(tx, user, {
      action: "JOB_TASK_ADDED",
      module: "Jobs",
      entityType: "Job",
      entityId: jobId,
      reference: job.jobNumber,
      jobId,
      message: `${job.jobNumber}: task "${parsed.data.title}" added.`,
    });
  });
  refresh(jobId);
  return ok;
}

export async function setTaskStatusAction(jobId: string, taskId: string, status: "TODO" | "IN_PROGRESS" | "DONE"): Promise<State> {
  const user = await requireStaff();
  const task = await prisma.jobTask.findUniqueOrThrow({ where: { id: taskId }, include: { job: true } });
  if (task.jobId !== jobId) return { error: "Task not found." };
  if (task.job.status === "CLOSED" || task.job.status === "CANCELLED") return { error: `The job is ${task.job.status.toLowerCase()}.` };
  await prisma.$transaction(async (tx) => {
    await tx.jobTask.update({ where: { id: taskId }, data: { status, completedAt: status === "DONE" ? new Date() : null } });
    if (status === "DONE") {
      await audit(tx, user, {
        action: "JOB_TASK_DONE",
        module: "Jobs",
        entityType: "Job",
        entityId: jobId,
        reference: task.job.jobNumber,
        jobId,
        message: `${task.job.jobNumber}: task "${task.title}" completed.`,
      });
    }
  });
  refresh(jobId);
  return ok;
}

// ---------------------------------------------------------------------------
// Job details & service-specific fields
// ---------------------------------------------------------------------------

const optionalMoney = z.union([z.literal(""), z.coerce.number().min(0, "Amounts can't be negative")]);
const coreSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  responsibleId: z.string(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
  dueDate: z.string(),
  estimatedRevenue: optionalMoney,
  estimatedCost: optionalMoney,
  shipmentId: z.string(),
});

export async function updateJobAction(jobId: string, _prev: State, formData: FormData): Promise<State> {
  const user = await requireStaff();
  const parsed = coreSchema.safeParse({
    title: formData.get("title") ?? "",
    responsibleId: formData.get("responsibleId") ?? "",
    priority: formData.get("priority") ?? "NORMAL",
    dueDate: formData.get("dueDate") ?? "",
    estimatedRevenue: formData.get("estimatedRevenue") ?? "",
    estimatedCost: formData.get("estimatedCost") ?? "",
    shipmentId: formData.get("shipmentId") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const job = await loadJob(jobId);
  if (job.status === "CLOSED" || job.status === "CANCELLED") return { error: `The job is ${job.status.toLowerCase()}.` };

  // Service-specific fields: validated against the service's field list.
  const details: Record<string, string | number | null> = {};
  for (const field of parseFields(job.service.fields)) {
    const raw = String(formData.get(`field_${field.key}`) ?? "").trim();
    if (raw === "") {
      details[field.key] = null;
      continue;
    }
    if (field.type === "number") {
      const n = Number(raw);
      if (!Number.isFinite(n)) return { error: `${field.label} must be a number.` };
      details[field.key] = n;
    } else if (field.type === "date") {
      if (Number.isNaN(new Date(raw).getTime())) return { error: `${field.label} must be a date.` };
      details[field.key] = raw;
    } else if (field.type === "select" && field.options && !field.options.includes(raw)) {
      return { error: `Choose a valid ${field.label}.` };
    } else {
      details[field.key] = raw.slice(0, 2000);
    }
  }
  if (parsed.data.shipmentId) {
    const shipment = await prisma.shipment.findUnique({ where: { id: parsed.data.shipmentId } });
    if (!shipment || shipment.clientId !== job.clientId) return { error: "That shipment belongs to a different client." };
  }

  const changes = {
    title: parsed.data.title,
    responsibleId: parsed.data.responsibleId || null,
    priority: parsed.data.priority,
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    estimatedRevenue: parsed.data.estimatedRevenue === "" ? null : parsed.data.estimatedRevenue,
    estimatedCost: parsed.data.estimatedCost === "" ? null : parsed.data.estimatedCost,
    shipmentId: parsed.data.shipmentId || null,
  };
  await prisma.$transaction(async (tx) => {
    await tx.job.update({ where: { id: jobId }, data: { ...changes, details: { ...detailsOf(job.details), ...details } as Prisma.InputJsonValue } });
    await audit(tx, user, {
      action: "JOB_UPDATED",
      module: "Jobs",
      entityType: "Job",
      entityId: jobId,
      reference: job.jobNumber,
      jobId,
      message: `${job.jobNumber}: details updated.`,
      before: { details: detailsOf(job.details), responsibleId: job.responsibleId, dueDate: job.dueDate?.toISOString() ?? null } as Prisma.InputJsonValue,
      after: { details, responsibleId: changes.responsibleId, dueDate: changes.dueDate?.toISOString() ?? null } as Prisma.InputJsonValue,
    });
  });
  refresh(jobId);
  return ok;
}

// ---------------------------------------------------------------------------
// Billing: invoice a job (on a new invoice or a client's open draft)
// ---------------------------------------------------------------------------

const billSchema = z.object({
  target: z.string().min(1),
  expenseIds: z.array(z.string()),
  feeDescription: z.string().trim(),
  feeAmount: z.union([z.literal(""), z.coerce.number().positive("The service fee must be greater than zero")]),
});

export async function invoiceJobAction(jobId: string, _prev: State, formData: FormData): Promise<State> {
  const user = await requireStaff();
  const parsed = billSchema.safeParse({
    target: formData.get("target") ?? "new",
    expenseIds: formData.getAll("expenseIds"),
    feeDescription: formData.get("feeDescription") ?? "",
    feeAmount: formData.get("feeAmount") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const d = parsed.data;

  const job = await prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    include: {
      client: true,
      service: true,
      expenses: { include: { invoiceItem: { include: { invoice: true } } } },
    },
  });
  if (job.status === "CANCELLED" || job.status === "CLOSED") return { error: `The job is ${job.status.toLowerCase()}.` };

  const chosen = job.expenses.filter((e) => d.expenseIds.includes(e.id));
  if (chosen.length !== d.expenseIds.length) return { error: "One of the selected costs doesn't belong to this job." };
  for (const e of chosen) {
    if (e.billingType === "NON_BILLABLE") return { error: `"${e.description}" is a company cost and can't be re-charged.` };
    if (e.status === "REJECTED") return { error: `"${e.description}" was rejected.` };
    if (isExpenseBilled((e.invoiceItem?.invoice.status as InvoiceStatus | undefined) ?? null)) {
      return { error: `"${e.description}" is already on invoice ${e.invoiceItem?.invoice.invoiceNumber}.` };
    }
  }
  const lines: Prisma.InvoiceItemCreateWithoutInvoiceInput[] = [];
  for (const e of chosen) {
    lines.push({
      description: `${e.description} (re-charged at cost)`,
      quantity: 1,
      unitPrice: e.amount,
      job: { connect: { id: job.id } },
      sourceExpense: { connect: { id: e.id } },
    });
    if (e.billingType === "BILLABLE_WITH_MARKUP" && Number(e.markupAmount) > 0) {
      lines.push({ description: `Handling / service fee -- ${e.description}`, quantity: 1, unitPrice: e.markupAmount, job: { connect: { id: job.id } } });
    }
  }
  if (d.feeAmount !== "") {
    lines.push({
      description: d.feeDescription || `${job.service.name} -- service fee (${job.jobNumber})`,
      quantity: 1,
      unitPrice: d.feeAmount,
      job: { connect: { id: job.id } },
    });
  }
  if (lines.length === 0) return { error: "Choose costs to re-charge and/or enter a service fee." };

  let draftInvoiceId: string | null = null;
  if (d.target !== "new") {
    const draft = await prisma.invoice.findUnique({ where: { id: d.target } });
    if (!draft || draft.clientId !== job.clientId || draft.status !== "DRAFT") return { error: "Choose one of this client's draft invoices." };
    draftInvoiceId = draft.id;
  }

  const invoice = await prisma.$transaction(async (tx) => {
    // A cost previously billed on a cancelled invoice is released so it can be billed again.
    for (const e of chosen) {
      if (e.invoiceItem) await tx.invoiceItem.update({ where: { id: e.invoiceItem.id }, data: { sourceExpenseId: null } });
    }
    let inv;
    if (draftInvoiceId) {
      inv = await tx.invoice.update({ where: { id: draftInvoiceId }, data: { items: { create: lines } } });
    } else {
      const due = new Date();
      due.setDate(due.getDate() + (job.client.paymentTermsDays ?? 14));
      inv = await tx.invoice.create({
        data: {
          invoiceNumber: await nextInvoiceNumber(tx),
          clientId: job.clientId,
          shipmentId: job.shipmentId,
          dueDate: due,
          items: { create: lines },
        },
      });
    }
    const total = lines.reduce((s, l) => s + Number(l.quantity ?? 1) * Number(l.unitPrice), 0);
    await audit(tx, user, {
      action: "JOB_INVOICED",
      module: "Billing",
      entityType: "Invoice",
      entityId: inv.id,
      reference: inv.invoiceNumber,
      jobId,
      message: `${job.jobNumber}: ${lines.length} line(s) totalling ${total.toFixed(2)} added to draft invoice ${inv.invoiceNumber}.`,
    });
    return inv;
  });

  refresh(jobId);
  revalidatePath(`/invoices/${invoice.id}`);
  revalidatePath("/invoices");
  return ok;
}
