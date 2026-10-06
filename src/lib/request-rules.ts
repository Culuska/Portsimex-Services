// Service Request status rules. Pure module (unit tested).
//   Draft -> Submitted -> Reviewed -> Quoted -> Approved -> In Progress
//   -> (Waiting) -> Completed -> Closed, with Cancelled possible until work starts.

export type RequestStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "REVIEWED"
  | "QUOTED"
  | "APPROVED"
  | "IN_PROGRESS"
  | "WAITING"
  | "COMPLETED"
  | "CLOSED"
  | "CANCELLED";

// Manual moves a user can make. IN_PROGRESS / COMPLETED / CLOSED are driven
// by the request's jobs (see deriveRequestStatus), not set by hand.
const MANUAL: Record<RequestStatus, RequestStatus[]> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["REVIEWED", "APPROVED", "CANCELLED"],
  REVIEWED: ["QUOTED", "APPROVED", "CANCELLED"],
  QUOTED: ["APPROVED", "CANCELLED"],
  APPROVED: ["CANCELLED"],
  IN_PROGRESS: ["WAITING"],
  WAITING: ["IN_PROGRESS"],
  COMPLETED: [],
  CLOSED: [],
  CANCELLED: [],
};

// Approval (and opening jobs) is a manager decision.
export const MANAGER_ONLY: RequestStatus[] = ["APPROVED", "CANCELLED"];

export function allowedRequestMoves(from: RequestStatus): RequestStatus[] {
  return MANUAL[from];
}

export function canMoveRequest(from: RequestStatus, to: RequestStatus): boolean {
  return MANUAL[from].includes(to);
}

type JobStatus = "OPEN" | "IN_PROGRESS" | "WAITING" | "COMPLETED" | "CLOSED" | "CANCELLED";

/** Status implied by the request's jobs, or null to leave the request as it is. */
export function deriveRequestStatus(current: RequestStatus, jobStatuses: JobStatus[]): RequestStatus | null {
  const live = jobStatuses.filter((s) => s !== "CANCELLED");
  if (live.length === 0) return null;
  if (live.every((s) => s === "CLOSED")) return "CLOSED";
  if (live.every((s) => s === "COMPLETED" || s === "CLOSED")) return "COMPLETED";
  // Keep a manual WAITING while jobs are still running; otherwise work is under way.
  if (current === "WAITING") return null;
  return current === "IN_PROGRESS" ? null : "IN_PROGRESS";
}
