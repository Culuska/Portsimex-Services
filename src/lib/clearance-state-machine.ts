export type ApprovalStepStatus =
  | "PENDING"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "CORRECTION_REQUESTED";

export type ApprovalActionType = "APPROVE" | "REJECT" | "REQUEST_CORRECTION";

export type ClearanceStatus =
  | "NOT_STARTED"
  | "IN_REVIEW"
  | "AWAITING_VENDOR_CORRECTION"
  | "CLEARED_FOR_DELIVERY"
  | "REJECTED";

export class InvalidTransitionError extends Error {}

/**
 * Only the ministry currently "in review" may act, and only that ministry's
 * own officers (or an admin) may act at its own step. Throws rather than
 * returning a boolean so the caller can't accidentally ignore the result.
 */
export function assertCanAct(
  step: { status: ApprovalStepStatus; ministryId: string },
  actor: { ministryId: string | null; isAdmin: boolean },
): void {
  if (step.status !== "IN_REVIEW") {
    throw new InvalidTransitionError(
      `Step is not currently in review (status: ${step.status})`,
    );
  }
  if (!actor.isAdmin && actor.ministryId !== step.ministryId) {
    throw new InvalidTransitionError(
      "This ministry is not authorized to act on this step",
    );
  }
}

export type ApplyActionResult = {
  stepStatus: ApprovalStepStatus;
  /** Status to set on the next step in the chain, or null if there is none to advance. */
  advanceNextStep: boolean;
  shipmentClearanceStatus: ClearanceStatus;
};

/**
 * Pure decision logic for one ministry's action on the currently active
 * step. Sequencing (finding/activating the next step, or marking the
 * shipment cleared) is orchestrated by the caller using `advanceNextStep`
 * and `isLastInChain`.
 */
export function applyAction(
  action: ApprovalActionType,
  isLastInChain: boolean,
): ApplyActionResult {
  switch (action) {
    case "APPROVE":
      return {
        stepStatus: "APPROVED",
        advanceNextStep: !isLastInChain,
        shipmentClearanceStatus: isLastInChain ? "CLEARED_FOR_DELIVERY" : "IN_REVIEW",
      };
    case "REJECT":
      return {
        stepStatus: "REJECTED",
        advanceNextStep: false,
        shipmentClearanceStatus: "REJECTED",
      };
    case "REQUEST_CORRECTION":
      return {
        stepStatus: "CORRECTION_REQUESTED",
        advanceNextStep: false,
        shipmentClearanceStatus: "AWAITING_VENDOR_CORRECTION",
      };
  }
}

/**
 * A vendor resubmitting a corrected document puts the SAME step back into
 * review at the SAME ministry -- it does not restart the whole chain.
 */
export function applyVendorResubmit(step: { status: ApprovalStepStatus }): {
  stepStatus: ApprovalStepStatus;
  shipmentClearanceStatus: ClearanceStatus;
} {
  if (step.status !== "CORRECTION_REQUESTED") {
    throw new InvalidTransitionError(
      `Can only resubmit when a correction was requested (status: ${step.status})`,
    );
  }
  return { stepStatus: "IN_REVIEW", shipmentClearanceStatus: "IN_REVIEW" };
}
