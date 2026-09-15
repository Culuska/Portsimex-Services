export type ExpenseStatus = "PENDING" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "PAID";

// Operational expense payouts over this amount must clear managerial
// approval before they can be marked PAID -- they cannot auto-pay.
export const EXPENSE_APPROVAL_THRESHOLD = 500;

export class InvalidExpenseTransitionError extends Error {}

// Applied whenever an expense is created or edited with a user-requested
// status. Amounts over the threshold are always forced into the approval
// queue, even if the form asked for PAID directly -- this cannot be
// bypassed from the client.
export function decideExpenseStatus(
  amount: number,
  requestedStatus: "PENDING" | "PAID",
): ExpenseStatus {
  if (amount > EXPENSE_APPROVAL_THRESHOLD) {
    return "PENDING_APPROVAL";
  }
  return requestedStatus;
}

const ALLOWED_TRANSITIONS: Record<ExpenseStatus, ExpenseStatus[]> = {
  PENDING: ["PAID"],
  PENDING_APPROVAL: ["APPROVED", "REJECTED"],
  APPROVED: ["PAID"],
  REJECTED: [],
  PAID: [],
};

// Guards every expense status change against skipping the approval queue
// (e.g. PENDING_APPROVAL -> PAID directly) or acting on a terminal state.
export function assertCanTransitionExpenseStatus(
  current: ExpenseStatus,
  target: ExpenseStatus,
): void {
  if (current === target) return;
  if (!ALLOWED_TRANSITIONS[current].includes(target)) {
    throw new InvalidExpenseTransitionError(`Cannot move expense from ${current} to ${target}`);
  }
}
