// Business rules for Jobs/Cases: stage gating, document completeness,
// completion and closure conditions, SLA status, bulk reconciliation.
// Pure module (no app imports) so every rule is unit tested, and enforced
// in server actions -- never only in the UI.

export type JobStatus = "OPEN" | "IN_PROGRESS" | "WAITING" | "COMPLETED" | "CLOSED" | "CANCELLED";
export type StageStatus = "PENDING" | "IN_PROGRESS" | "DONE" | "SKIPPED";

type StageLike = { id: string; position: number; name: string; status: StageStatus; requiresDocuments: boolean };
type DocLike = { name: string; required: boolean; isOutput: boolean; received: boolean; waived?: boolean };

export const ACTIVE_JOB_STATUSES: JobStatus[] = ["OPEN", "IN_PROGRESS", "WAITING"];

export function isJobActive(status: JobStatus): boolean {
  return ACTIVE_JOB_STATUSES.includes(status);
}

const JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  OPEN: ["IN_PROGRESS", "WAITING", "CANCELLED"],
  IN_PROGRESS: ["WAITING", "COMPLETED", "CANCELLED"],
  WAITING: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  // Reopening is allowed (e.g. a correction after completion), closing is final.
  COMPLETED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: [],
  CANCELLED: [],
};

export class JobRuleError extends Error {}

export function assertJobTransition(from: JobStatus, to: JobStatus) {
  if (from === to) return;
  if (!JOB_TRANSITIONS[from].includes(to)) {
    throw new JobRuleError(`A ${label(from)} job cannot be moved to ${label(to)}.`);
  }
}

function label(status: string) {
  return status.replace(/_/g, " ").toLowerCase();
}

/** Required supporting documents still missing (output documents excluded -- they arrive at the end). */
export function missingRequiredDocuments(docs: DocLike[]): DocLike[] {
  return docs.filter((d) => d.required && !d.isOutput && !d.received && !d.waived);
}

/** Official output documents (certificate, POD, final visa...) not yet received. */
export function missingOutputDocuments(docs: DocLike[]): DocLike[] {
  return docs.filter((d) => d.required && d.isOutput && !d.received && !d.waived);
}

export function isDocumentationComplete(docs: DocLike[]): boolean {
  return missingRequiredDocuments(docs).length === 0;
}

/** The stage currently being worked on: the first one not yet done or skipped. */
export function currentStage<T extends StageLike>(stages: T[]): T | null {
  return [...stages].sort((a, b) => a.position - b.position).find((s) => s.status === "PENDING" || s.status === "IN_PROGRESS") ?? null;
}

export function checkCompleteStage(stage: StageLike, stages: StageLike[], docs: DocLike[], jobStatus: JobStatus): string | null {
  if (!isJobActive(jobStatus)) return `The job is ${label(jobStatus)} -- reopen it before changing its workflow.`;
  const current = currentStage(stages);
  if (!current || current.id !== stage.id) {
    return `Stages are completed in order -- "${current?.name ?? "none"}" is the current stage.`;
  }
  if (stage.requiresDocuments) {
    const missing = missingRequiredDocuments(docs);
    if (missing.length > 0) {
      return `DOCUMENTATION INCOMPLETE -- missing: ${missing.map((d) => d.name).join(", ")}.`;
    }
  }
  return null;
}

export type Reconciliation = { requested: number; processed: number; failed: number; balanced: boolean };

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Bulk services: requested must equal processed + failed, with something actually processed. */
export function reconcileQuantities(details: Record<string, unknown>): Reconciliation | null {
  const requested = num(details.quantityRequested);
  if (requested === null) return null;
  const processed = num(details.quantityProcessed) ?? 0;
  const failed = num(details.quantityFailed) ?? 0;
  return { requested, processed, failed, balanced: requested > 0 && processed + failed === requested };
}

export function completionBlockers(input: {
  status: JobStatus;
  stages: StageLike[];
  docs: DocLike[];
  reconcile: boolean;
  details: Record<string, unknown>;
}): string[] {
  const blockers: string[] = [];
  if (!isJobActive(input.status)) blockers.push(`The job is ${label(input.status)}.`);
  const open = input.stages.filter((s) => s.status === "PENDING" || s.status === "IN_PROGRESS");
  if (open.length > 0) blockers.push(`${open.length} workflow stage(s) not finished (next: ${currentStage(input.stages)?.name}).`);
  const missing = missingRequiredDocuments(input.docs);
  if (missing.length > 0) blockers.push(`DOCUMENTATION INCOMPLETE -- missing: ${missing.map((d) => d.name).join(", ")}.`);
  const output = missingOutputDocuments(input.docs);
  if (output.length > 0) blockers.push(`Official output not yet received: ${output.map((d) => d.name).join(", ")}.`);
  if (input.reconcile) {
    const r = reconcileQuantities(input.details);
    if (!r) blockers.push("Enter the quantity requested, processed and failed before completing.");
    else if (!r.balanced) {
      blockers.push(`Quantities not reconciled: requested ${r.requested}, processed ${r.processed}, failed ${r.failed}.`);
    }
  }
  return blockers;
}

export function closureBlockers(input: {
  status: JobStatus;
  unbilledBillableCosts: number;
  invoicedTotal: number;
  outstanding: number;
  draftInvoiceLines: number;
}): string[] {
  const blockers: string[] = [];
  if (input.status !== "COMPLETED") blockers.push("Only a completed job can be closed.");
  if (input.unbilledBillableCosts > 0.005) blockers.push("There are billable costs not yet invoiced to the client.");
  if (input.draftInvoiceLines > 0) blockers.push("Some of this job's invoice lines are still on a draft invoice.");
  if (input.invoicedTotal <= 0) blockers.push("The job has not been invoiced yet.");
  if (input.outstanding > 0.005) blockers.push("The client has not fully paid this job's invoices.");
  return blockers;
}

export type SlaState = "NO_SLA" | "ON_TRACK" | "DUE_SOON" | "DUE_TODAY" | "OVERDUE" | "COMPLETED_ON_TIME" | "COMPLETED_LATE";

export const SLA_DUE_SOON_DAYS = 3;

function dayStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function slaState(input: { dueDate: Date | null; completedAt: Date | null; status: JobStatus }, now = new Date()): SlaState {
  if (!input.dueDate) return "NO_SLA";
  const due = dayStart(input.dueDate);
  if (input.completedAt) return dayStart(input.completedAt) <= due ? "COMPLETED_ON_TIME" : "COMPLETED_LATE";
  if (input.status === "CANCELLED") return "NO_SLA";
  const today = dayStart(now);
  if (today > due) return "OVERDUE";
  if (today === due) return "DUE_TODAY";
  if (due - today <= SLA_DUE_SOON_DAYS * 86_400_000) return "DUE_SOON";
  return "ON_TRACK";
}

/** SLA due date: start + turnaround days, but never later than the client's required-by date. */
export function computeDueDate(start: Date, slaDays: number | null, requiredBy: Date | null): Date | null {
  const sla = slaDays === null ? null : new Date(start.getTime() + slaDays * 86_400_000);
  if (sla && requiredBy) return sla < requiredBy ? sla : requiredBy;
  return sla ?? requiredBy;
}
