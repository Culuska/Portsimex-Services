import { describe, expect, it } from "vitest";
import {
  applyAction,
  applyVendorResubmit,
  assertCanAct,
  InvalidTransitionError,
} from "./clearance-state-machine";

describe("assertCanAct", () => {
  it("allows the scoped ministry officer to act when the step is in review", () => {
    expect(() =>
      assertCanAct(
        { status: "IN_REVIEW", ministryId: "m1" },
        { ministryId: "m1", isAdmin: false },
      ),
    ).not.toThrow();
  });

  it("allows an admin to act regardless of ministry scope", () => {
    expect(() =>
      assertCanAct(
        { status: "IN_REVIEW", ministryId: "m1" },
        { ministryId: null, isAdmin: true },
      ),
    ).not.toThrow();
  });

  it("rejects a ministry acting out of turn (wrong ministry)", () => {
    expect(() =>
      assertCanAct(
        { status: "IN_REVIEW", ministryId: "m1" },
        { ministryId: "m2", isAdmin: false },
      ),
    ).toThrow(InvalidTransitionError);
  });

  it("rejects acting on a step that isn't in review (e.g. still pending)", () => {
    expect(() =>
      assertCanAct(
        { status: "PENDING", ministryId: "m1" },
        { ministryId: "m1", isAdmin: false },
      ),
    ).toThrow(InvalidTransitionError);
  });

  it("rejects acting on an already-decided step", () => {
    for (const status of ["APPROVED", "REJECTED", "CORRECTION_REQUESTED"] as const) {
      expect(() =>
        assertCanAct({ status, ministryId: "m1" }, { ministryId: "m1", isAdmin: false }),
      ).toThrow(InvalidTransitionError);
    }
  });
});

describe("applyAction", () => {
  it("approve, not last in chain -> advances to next step, shipment stays in review", () => {
    const result = applyAction("APPROVE", false);
    expect(result).toEqual({
      stepStatus: "APPROVED",
      advanceNextStep: true,
      shipmentClearanceStatus: "IN_REVIEW",
    });
  });

  it("approve, last in chain -> shipment is cleared for delivery", () => {
    const result = applyAction("APPROVE", true);
    expect(result).toEqual({
      stepStatus: "APPROVED",
      advanceNextStep: false,
      shipmentClearanceStatus: "CLEARED_FOR_DELIVERY",
    });
  });

  it("reject halts the chain and is terminal, regardless of position", () => {
    expect(applyAction("REJECT", false)).toEqual({
      stepStatus: "REJECTED",
      advanceNextStep: false,
      shipmentClearanceStatus: "REJECTED",
    });
    expect(applyAction("REJECT", true)).toEqual({
      stepStatus: "REJECTED",
      advanceNextStep: false,
      shipmentClearanceStatus: "REJECTED",
    });
  });

  it("request correction puts the shipment in awaiting-correction, does not advance", () => {
    const result = applyAction("REQUEST_CORRECTION", false);
    expect(result).toEqual({
      stepStatus: "CORRECTION_REQUESTED",
      advanceNextStep: false,
      shipmentClearanceStatus: "AWAITING_VENDOR_CORRECTION",
    });
  });
});

describe("applyVendorResubmit", () => {
  it("puts a correction-requested step back in review at the same ministry", () => {
    const result = applyVendorResubmit({ status: "CORRECTION_REQUESTED" });
    expect(result).toEqual({
      stepStatus: "IN_REVIEW",
      shipmentClearanceStatus: "IN_REVIEW",
    });
  });

  it("rejects resubmitting when no correction was requested", () => {
    for (const status of ["PENDING", "IN_REVIEW", "APPROVED", "REJECTED"] as const) {
      expect(() => applyVendorResubmit({ status })).toThrow(InvalidTransitionError);
    }
  });
});
