import { describe, expect, it } from "vitest";
import {
  EXPENSE_APPROVAL_THRESHOLD,
  InvalidExpenseTransitionError,
  assertCanTransitionExpenseStatus,
  decideExpenseStatus,
} from "./expense-approval";

describe("decideExpenseStatus", () => {
  it("allows PENDING for small amounts", () => {
    expect(decideExpenseStatus(100, "PENDING")).toBe("PENDING");
  });

  it("allows PAID for small amounts", () => {
    expect(decideExpenseStatus(EXPENSE_APPROVAL_THRESHOLD, "PAID")).toBe("PAID");
  });

  it("forces PENDING_APPROVAL above the threshold even when PAID was requested", () => {
    expect(decideExpenseStatus(EXPENSE_APPROVAL_THRESHOLD + 0.01, "PAID")).toBe("PENDING_APPROVAL");
  });

  it("forces PENDING_APPROVAL above the threshold when PENDING was requested", () => {
    expect(decideExpenseStatus(5000, "PENDING")).toBe("PENDING_APPROVAL");
  });
});

describe("assertCanTransitionExpenseStatus", () => {
  it("allows PENDING -> PAID", () => {
    expect(() => assertCanTransitionExpenseStatus("PENDING", "PAID")).not.toThrow();
  });

  it("allows PENDING_APPROVAL -> APPROVED", () => {
    expect(() => assertCanTransitionExpenseStatus("PENDING_APPROVAL", "APPROVED")).not.toThrow();
  });

  it("allows PENDING_APPROVAL -> REJECTED", () => {
    expect(() => assertCanTransitionExpenseStatus("PENDING_APPROVAL", "REJECTED")).not.toThrow();
  });

  it("allows APPROVED -> PAID", () => {
    expect(() => assertCanTransitionExpenseStatus("APPROVED", "PAID")).not.toThrow();
  });

  it("rejects PENDING_APPROVAL -> PAID (must clear approval first)", () => {
    expect(() => assertCanTransitionExpenseStatus("PENDING_APPROVAL", "PAID")).toThrow(
      InvalidExpenseTransitionError,
    );
  });

  it("rejects acting on a terminal PAID expense", () => {
    expect(() => assertCanTransitionExpenseStatus("PAID", "PENDING_APPROVAL")).toThrow(
      InvalidExpenseTransitionError,
    );
  });

  it("rejects acting on a terminal REJECTED expense", () => {
    expect(() => assertCanTransitionExpenseStatus("REJECTED", "APPROVED")).toThrow(
      InvalidExpenseTransitionError,
    );
  });

  it("is a no-op when current equals target", () => {
    expect(() => assertCanTransitionExpenseStatus("PENDING", "PENDING")).not.toThrow();
  });
});
