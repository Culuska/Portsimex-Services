// Case status for government / tax / immigration jobs, derived from the
// job's real state (documents, submissions, completion) rather than stored
// separately -- so it can never disagree with what has actually happened.
// Pure module (unit tested).

import type { SubmissionStatus } from "./submission-rules";

export type CaseStatus =
  | "DOCUMENTS_PENDING"
  | "PREPARING"
  | "READY_FOR_SUBMISSION"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "INFO_REQUIRED"
  | "APPROVED"
  | "REJECTED"
  | "WITHDRAWN"
  | "OUTPUT_RECEIVED"
  | "DELIVERED"
  | "CLOSED"
  | "CANCELLED";

type Doc = { required: boolean; isOutput: boolean; received: boolean; waived?: boolean };
type Stage = { name: string; position: number; status: string };

export function caseStatusLabel(status: CaseStatus, kind: "TAX" | "IMMIGRATION" | "GOVERNMENT"): string {
  switch (status) {
    case "DOCUMENTS_PENDING":
      return "Documents pending";
    case "PREPARING":
      return "Preparing";
    case "READY_FOR_SUBMISSION":
      return "Ready for submission";
    case "SUBMITTED":
      return "Submitted";
    case "UNDER_REVIEW":
      return "Under review";
    case "INFO_REQUIRED":
      return "Additional information required";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "WITHDRAWN":
      return "Withdrawn";
    case "OUTPUT_RECEIVED":
      return kind === "TAX" ? "Certificate received" : kind === "IMMIGRATION" ? "Document received" : "Response received";
    case "DELIVERED":
      return "Delivered to client";
    case "CLOSED":
      return "Closed";
    case "CANCELLED":
      return "Cancelled";
  }
}

export function deriveCaseStatus(input: {
  jobStatus: string;
  docs: Doc[];
  stages: Stage[];
  latestSubmission: { status: SubmissionStatus } | null;
}): CaseStatus {
  if (input.jobStatus === "CANCELLED") return "CANCELLED";
  if (input.jobStatus === "CLOSED") return "CLOSED";
  if (input.jobStatus === "COMPLETED") return "DELIVERED";

  const outputs = input.docs.filter((d) => d.isOutput && d.required);
  if (outputs.length > 0 && outputs.every((d) => d.received)) return "OUTPUT_RECEIVED";

  if (input.latestSubmission) return input.latestSubmission.status;

  const missing = input.docs.some((d) => d.required && !d.isOutput && !d.received && !d.waived);
  if (missing) return "DOCUMENTS_PENDING";

  // Documents are complete and nothing has been submitted yet: "ready" once
  // the workflow has reached its submission stage, otherwise still preparing.
  const submissionStage = input.stages.find((s) => /submi/i.test(s.name));
  const current = [...input.stages].sort((a, b) => a.position - b.position).find((s) => s.status === "PENDING" || s.status === "IN_PROGRESS");
  if (submissionStage && current && current.position >= submissionStage.position) return "READY_FOR_SUBMISSION";
  return "PREPARING";
}

// Which workflow stages a case event completes, so recording a submission,
// a decision or the official output moves the timeline along instead of
// staff ticking the same step twice. Matched by stage name, in order, only
// while the matching stage is the current one.
export const STAGE_EVENTS = {
  SUBMITTED: /submi/i,
  DECIDED: /review|follow|approv|reject|decision|response/i,
  OUTPUT_RECEIVED: /certificate|collection|document received|response received/i,
} as const;

/** Ids of the consecutive current stages (in order) whose names match. */
export function stagesToAutoComplete<T extends { id: string; name: string; position: number; status: string }>(stages: T[], pattern: RegExp): T[] {
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  const start = ordered.findIndex((s) => s.status === "PENDING" || s.status === "IN_PROGRESS");
  if (start < 0) return [];
  const out: T[] = [];
  for (const s of ordered.slice(start)) {
    if (!pattern.test(s.name)) break;
    out.push(s);
  }
  return out;
}
