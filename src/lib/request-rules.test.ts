import { describe, expect, it } from "vitest";
import { canMoveRequest, deriveRequestStatus } from "./request-rules";

describe("service request status", () => {
  it("follows the request lifecycle", () => {
    expect(canMoveRequest("DRAFT", "SUBMITTED")).toBe(true);
    expect(canMoveRequest("SUBMITTED", "APPROVED")).toBe(true);
    expect(canMoveRequest("DRAFT", "APPROVED")).toBe(false);
    expect(canMoveRequest("CLOSED", "IN_PROGRESS")).toBe(false);
  });
  it("is driven by its jobs once work starts", () => {
    expect(deriveRequestStatus("APPROVED", ["OPEN"])).toBe("IN_PROGRESS");
    expect(deriveRequestStatus("IN_PROGRESS", ["COMPLETED", "OPEN"])).toBeNull();
    expect(deriveRequestStatus("IN_PROGRESS", ["COMPLETED", "CLOSED", "CANCELLED"])).toBe("COMPLETED");
    expect(deriveRequestStatus("COMPLETED", ["CLOSED", "CLOSED"])).toBe("CLOSED");
    expect(deriveRequestStatus("WAITING", ["IN_PROGRESS"])).toBeNull();
    expect(deriveRequestStatus("APPROVED", ["CANCELLED"])).toBeNull();
  });
});
