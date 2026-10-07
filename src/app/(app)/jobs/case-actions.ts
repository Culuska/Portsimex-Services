"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireJobAccess } from "@/lib/session";
import { audit } from "@/lib/audit";
import { detailsOf } from "@/lib/jobs";
import { isJobActive, missingRequiredDocuments } from "@/lib/job-rules";
import { canMoveSubmission, nextFollowUpFor, SUBMISSION_STATUS_LABELS, type SubmissionStatus } from "@/lib/submission-rules";
import { dateValue, fillEmptyDetails } from "@/lib/case-details";
import { STAGE_EVENTS, stagesToAutoComplete } from "@/lib/case-status";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// Completes the workflow stages a case event covers (see STAGE_EVENTS) and
// opens the next one, with an audit entry naming what moved.
async function autoAdvance(tx: Tx, jobId: string, jobNumber: string, pattern: RegExp, user: { id: string; name?: string | null }, why: string) {
  const stages = await tx.jobStage.findMany({ where: { jobId } });
  const done = stagesToAutoComplete(stages, pattern);
  if (done.length === 0) return;
  const now = new Date();
  for (const s of done) {
    await tx.jobStage.update({ where: { id: s.id }, data: { status: "DONE", completedAt: now, completedById: user.id, note: why } });
  }
  const last = done[done.length - 1].position;
  const next = stages.filter((s) => s.position > last && s.status === "PENDING").sort((a, b) => a.position - b.position)[0];
  if (next) await tx.jobStage.update({ where: { id: next.id }, data: { status: "IN_PROGRESS", startedAt: now } });
  await audit(tx, user, {
    action: "JOB_STAGES_ADVANCED",
    module: "Jobs",
    entityType: "Job",
    entityId: jobId,
    reference: jobNumber,
    jobId,
    message: `${jobNumber}: ${why} -- completed ${done.map((s) => `"${s.name}"`).join(", ")}.`,
  });
}

type State = { error: string | null };
const ok: State = { error: null };

function refresh(jobId: string) {
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/cases");
  revalidatePath("/reminders");
}

function optionalDate(raw: FormDataEntryValue | null): Date | null | "invalid" {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "invalid" : d;
}

// ---------------------------------------------------------------------------
// Submissions to ministries / government / immigration offices
// ---------------------------------------------------------------------------

const submissionSchema = z.object({
  agencyId: z.string().min(1, "Choose the ministry / office"),
  reference: z.string().trim(),
  officerId: z.string(),
  notes: z.string().trim(),
  documentsSubmitted: z.array(z.string()),
});

export async function recordSubmissionAction(jobId: string, _prev: State, formData: FormData): Promise<State> {
  const user = await requireJobAccess(jobId, "cases.manage");
  const parsed = submissionSchema.safeParse({
    agencyId: formData.get("agencyId") ?? "",
    reference: formData.get("reference") ?? "",
    officerId: formData.get("officerId") ?? "",
    notes: formData.get("notes") ?? "",
    documentsSubmitted: formData.getAll("documentsSubmitted").map(String),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const submittedAt = optionalDate(formData.get("submittedAt"));
  const chosenFollowUp = optionalDate(formData.get("nextFollowUpAt"));
  if (submittedAt === "invalid" || chosenFollowUp === "invalid") return { error: "Enter valid dates." };

  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId }, include: { documents: true, service: true } });
  if (!isJobActive(job.status)) return { error: `The job is ${job.status.toLowerCase()}.` };
  // Nothing goes to a ministry with gaps in the file.
  const missing = missingRequiredDocuments(job.documents);
  if (missing.length > 0) return { error: `DOCUMENTATION INCOMPLETE -- can't submit without: ${missing.map((d) => d.name).join(", ")}.` };
  const agency = await prisma.governmentAgency.findUnique({ where: { id: parsed.data.agencyId } });
  if (!agency?.active) return { error: "Choose an active ministry / office." };
  const known = new Set(job.documents.map((d) => d.name));
  const docs = parsed.data.documentsSubmitted.filter((d) => known.has(d));

  const when = submittedAt ?? new Date();
  const details = fillEmptyDetails(detailsOf(job.details), job.service.fields, {
    submissionDate: dateValue(when),
    ministry: agency.name,
    agency: agency.name,
    office: agency.office ?? agency.name,
    submissionRef: parsed.data.reference,
    referenceNumber: parsed.data.reference,
  });

  await prisma.$transaction(async (tx) => {
    await tx.jobSubmission.create({
      data: {
        jobId,
        agencyId: agency.id,
        reference: parsed.data.reference || null,
        submittedAt: when,
        documentsSubmitted: docs,
        officerId: parsed.data.officerId || job.responsibleId || user.id,
        notes: parsed.data.notes || null,
        createdById: user.id,
        nextFollowUpAt: nextFollowUpFor("SUBMITTED", chosenFollowUp, agency.followUpDays),
      },
    });
    await tx.job.update({
      where: { id: jobId },
      data: { ...(job.status === "OPEN" ? { status: "IN_PROGRESS" } : {}), ...(details ? { details: details as Prisma.InputJsonValue } : {}) },
    });
    await audit(tx, user, {
      action: "CASE_SUBMITTED",
      module: "Cases",
      entityType: "Job",
      entityId: jobId,
      reference: job.jobNumber,
      jobId,
      message: `Submitted ${job.jobNumber} to ${agency.name}${parsed.data.reference ? ` (ref ${parsed.data.reference})` : ""} with ${docs.length} document(s).`,
    });
    await autoAdvance(tx, jobId, job.jobNumber, STAGE_EVENTS.SUBMITTED, user, `submitted to ${agency.name}`);
  });
  refresh(jobId);
  return ok;
}

const statusSchema = z.object({
  status: z.enum(["SUBMITTED", "UNDER_REVIEW", "INFO_REQUIRED", "APPROVED", "REJECTED", "WITHDRAWN"]),
  response: z.string().trim(),
  nextAction: z.string().trim(),
});

export async function updateSubmissionStatusAction(jobId: string, submissionId: string, _prev: State, formData: FormData): Promise<State> {
  const user = await requireJobAccess(jobId, "cases.manage");
  const parsed = statusSchema.safeParse({
    status: formData.get("status"),
    response: formData.get("response") ?? "",
    nextAction: formData.get("nextAction") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const chosenFollowUp = optionalDate(formData.get("nextFollowUpAt"));
  if (chosenFollowUp === "invalid") return { error: "Enter a valid follow-up date." };

  const sub = await prisma.jobSubmission.findUniqueOrThrow({ where: { id: submissionId }, include: { agency: true, job: { include: { service: true } } } });
  if (sub.jobId !== jobId) return { error: "Submission not found." };
  if (!isJobActive(sub.job.status)) return { error: `The job is ${sub.job.status.toLowerCase()}.` };
  const to = parsed.data.status as SubmissionStatus;
  if (!canMoveSubmission(sub.status, to)) return { error: `A ${SUBMISSION_STATUS_LABELS[sub.status].toLowerCase()} submission can't be marked ${SUBMISSION_STATUS_LABELS[to].toLowerCase()}.` };
  if ((to === "REJECTED" || to === "INFO_REQUIRED") && !parsed.data.response) {
    return { error: "Record what the ministry / office said." };
  }

  const decided = to === "APPROVED" || to === "REJECTED" || to === "INFO_REQUIRED";
  const details =
    to === "APPROVED" ? fillEmptyDetails(detailsOf(sub.job.details), sub.job.service.fields, { approvalDate: dateValue(new Date()) }) : null;

  await prisma.$transaction(async (tx) => {
    await tx.jobSubmission.update({
      where: { id: submissionId },
      data: {
        status: to,
        response: parsed.data.response || sub.response,
        respondedAt: decided ? new Date() : sub.respondedAt,
        nextAction: parsed.data.nextAction || null,
        nextFollowUpAt: nextFollowUpFor(to, chosenFollowUp, sub.agency.followUpDays),
      },
    });
    // While the case waits on the authorities (or the client, for missing
    // information), the job shows as WAITING; a decision puts it back to work.
    const jobStatus = to === "UNDER_REVIEW" || to === "INFO_REQUIRED" || to === "SUBMITTED" ? "WAITING" : "IN_PROGRESS";
    await tx.job.update({
      where: { id: jobId },
      data: { status: jobStatus, ...(details ? { details: details as Prisma.InputJsonValue } : {}) },
    });
    await audit(tx, user, {
      action: `CASE_${to}`,
      module: "Cases",
      entityType: "Job",
      entityId: jobId,
      reference: sub.job.jobNumber,
      jobId,
      message: `${sub.job.jobNumber}: ${sub.agency.name}${sub.reference ? ` ref ${sub.reference}` : ""} -- ${SUBMISSION_STATUS_LABELS[sub.status]} -> ${SUBMISSION_STATUS_LABELS[to]}${parsed.data.response ? `: ${parsed.data.response}` : ""}.`,
    });
    if (to === "APPROVED" || to === "REJECTED") {
      await autoAdvance(tx, jobId, sub.job.jobNumber, STAGE_EVENTS.DECIDED, user, `${sub.agency.name} ${to === "APPROVED" ? "approved" : "rejected"} the application`);
    }
  });
  refresh(jobId);
  return ok;
}

const followUpSchema = z.object({
  outcome: z.string().trim().min(2, "Record what happened on the follow-up"),
  contact: z.string().trim(),
  nextAction: z.string().trim(),
});

export async function recordFollowUpAction(jobId: string, submissionId: string, _prev: State, formData: FormData): Promise<State> {
  const user = await requireJobAccess(jobId, "cases.manage");
  const parsed = followUpSchema.safeParse({
    outcome: formData.get("outcome") ?? "",
    contact: formData.get("contact") ?? "",
    nextAction: formData.get("nextAction") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const followedUpAt = optionalDate(formData.get("followedUpAt"));
  const chosenNext = optionalDate(formData.get("nextFollowUpAt"));
  if (followedUpAt === "invalid" || chosenNext === "invalid") return { error: "Enter valid dates." };

  const sub = await prisma.jobSubmission.findUniqueOrThrow({ where: { id: submissionId }, include: { agency: true, job: true } });
  if (sub.jobId !== jobId) return { error: "Submission not found." };
  if (sub.job.status === "CLOSED" || sub.job.status === "CANCELLED") return { error: `The job is ${sub.job.status.toLowerCase()}.` };
  const next = nextFollowUpFor(sub.status, chosenNext, sub.agency.followUpDays);

  await prisma.$transaction(async (tx) => {
    await tx.jobFollowUp.create({
      data: {
        submissionId,
        followedUpAt: followedUpAt ?? new Date(),
        contact: parsed.data.contact || null,
        outcome: parsed.data.outcome,
        nextAction: parsed.data.nextAction || null,
        nextFollowUpAt: next,
        byId: user.id,
      },
    });
    await tx.jobSubmission.update({ where: { id: submissionId }, data: { nextFollowUpAt: next, nextAction: parsed.data.nextAction || sub.nextAction } });
    await audit(tx, user, {
      action: "CASE_FOLLOW_UP",
      module: "Cases",
      entityType: "Job",
      entityId: jobId,
      reference: sub.job.jobNumber,
      jobId,
      message: `${sub.job.jobNumber}: followed up with ${sub.agency.name}${parsed.data.contact ? ` (${parsed.data.contact})` : ""} -- ${parsed.data.outcome}${next ? `. Next follow-up ${dateValue(next)}` : ""}.`,
    });
  });
  refresh(jobId);
  return ok;
}

// ---------------------------------------------------------------------------
// Document waivers (manager only, always with a reason)
// ---------------------------------------------------------------------------

const waiveSchema = z.object({ reason: z.string().trim().min(5, "Give the reason for waiving this document") });

export async function waiveDocumentAction(jobId: string, docId: string, _prev: State, formData: FormData): Promise<State> {
  const user = await requireJobAccess(jobId, "jobs.supervise");
  const parsed = waiveSchema.safeParse({ reason: formData.get("reason") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const doc = await prisma.jobDocument.findUniqueOrThrow({ where: { id: docId }, include: { job: true } });
  if (doc.jobId !== jobId) return { error: "Document not found." };
  if (!isJobActive(doc.job.status)) return { error: `The job is ${doc.job.status.toLowerCase()}.` };
  if (doc.received) return { error: "This document has already been received." };
  await prisma.$transaction(async (tx) => {
    await tx.jobDocument.update({ where: { id: docId }, data: { waived: true, waivedReason: parsed.data.reason } });
    await audit(tx, user, {
      action: "JOB_DOCUMENT_WAIVED",
      module: "Jobs",
      entityType: "Job",
      entityId: jobId,
      reference: doc.job.jobNumber,
      jobId,
      message: `${doc.job.jobNumber}: "${doc.name}" waived -- ${parsed.data.reason}`,
    });
  });
  refresh(jobId);
  return ok;
}

export async function unwaiveDocumentAction(jobId: string, docId: string): Promise<State> {
  const user = await requireJobAccess(jobId, "jobs.supervise");
  const doc = await prisma.jobDocument.findUniqueOrThrow({ where: { id: docId }, include: { job: true } });
  if (doc.jobId !== jobId) return { error: "Document not found." };
  if (!isJobActive(doc.job.status)) return { error: `The job is ${doc.job.status.toLowerCase()}.` };
  await prisma.$transaction(async (tx) => {
    await tx.jobDocument.update({ where: { id: docId }, data: { waived: false, waivedReason: null } });
    await audit(tx, user, {
      action: "JOB_DOCUMENT_UNWAIVED",
      module: "Jobs",
      entityType: "Job",
      entityId: jobId,
      reference: doc.job.jobNumber,
      jobId,
      message: `${doc.job.jobNumber}: waiver on "${doc.name}" removed.`,
    });
  });
  refresh(jobId);
  return ok;
}
