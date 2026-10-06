// Government / immigration submission lifecycle. Pure module (unit tested).

export type SubmissionStatus = "SUBMITTED" | "UNDER_REVIEW" | "INFO_REQUIRED" | "APPROVED" | "REJECTED" | "WITHDRAWN";

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  INFO_REQUIRED: "Additional information required",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

const TRANSITIONS: Record<SubmissionStatus, SubmissionStatus[]> = {
  SUBMITTED: ["UNDER_REVIEW", "INFO_REQUIRED", "APPROVED", "REJECTED", "WITHDRAWN"],
  UNDER_REVIEW: ["INFO_REQUIRED", "APPROVED", "REJECTED", "WITHDRAWN"],
  // Once the missing information is handed in, the file goes back for review.
  INFO_REQUIRED: ["SUBMITTED", "UNDER_REVIEW", "WITHDRAWN"],
  APPROVED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

export function allowedSubmissionMoves(from: SubmissionStatus): SubmissionStatus[] {
  return TRANSITIONS[from];
}

export function canMoveSubmission(from: SubmissionStatus, to: SubmissionStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Still waiting on the agency -- needs follow-up. */
export function isSubmissionOpen(status: SubmissionStatus): boolean {
  return status === "SUBMITTED" || status === "UNDER_REVIEW" || status === "INFO_REQUIRED";
}

export function addDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Next follow-up date: the date the user chose, else the agency's usual
 * follow-up interval from now. Open submissions always get one, so nothing
 * can sit at a ministry unwatched; closed ones never do.
 */
export function nextFollowUpFor(status: SubmissionStatus, chosen: Date | null, agencyFollowUpDays: number, now = new Date()): Date | null {
  if (!isSubmissionOpen(status)) return null;
  return chosen ?? addDays(now, Math.max(1, agencyFollowUpDays));
}
