import { describe, expect, it } from "vitest";
import { canMoveSubmission, isSubmissionOpen, nextFollowUpFor } from "./submission-rules";
import { deriveCaseStatus, caseStatusLabel } from "./case-status";
import { daysUntil, expiryState, expiryThreshold, isExpiryField } from "./reminder-rules";
import { completionBlockers, missingOutputDocuments } from "./job-rules";

const stages = [
  { name: "Document collection", position: 0, status: "DONE" },
  { name: "Application preparation", position: 1, status: "IN_PROGRESS" },
  { name: "Ministry submission", position: 2, status: "PENDING" },
];
const docs = [
  { name: "Letter", required: true, isOutput: false, received: true },
  { name: "Invoice", required: true, isOutput: false, received: false },
  { name: "Certificate", required: true, isOutput: true, received: false },
];

describe("submission lifecycle", () => {
  it("moves from submitted through review to a decision", () => {
    expect(canMoveSubmission("SUBMITTED", "UNDER_REVIEW")).toBe(true);
    expect(canMoveSubmission("UNDER_REVIEW", "APPROVED")).toBe(true);
    expect(canMoveSubmission("INFO_REQUIRED", "SUBMITTED")).toBe(true);
    expect(canMoveSubmission("APPROVED", "REJECTED")).toBe(false);
    expect(canMoveSubmission("REJECTED", "SUBMITTED")).toBe(false);
  });
  it("keeps a follow-up date on every open submission", () => {
    const now = new Date(2026, 9, 6);
    expect(nextFollowUpFor("SUBMITTED", null, 7, now)?.getDate()).toBe(13);
    expect(nextFollowUpFor("INFO_REQUIRED", new Date(2026, 9, 8), 7, now)?.getDate()).toBe(8);
    expect(nextFollowUpFor("APPROVED", new Date(2026, 9, 8), 7, now)).toBeNull();
    expect(isSubmissionOpen("WITHDRAWN")).toBe(false);
  });
});

describe("case status", () => {
  it("shows documents pending until supporting documents are in", () => {
    expect(deriveCaseStatus({ jobStatus: "IN_PROGRESS", docs, stages, latestSubmission: null })).toBe("DOCUMENTS_PENDING");
  });
  it("is preparing, then ready once the submission stage is reached", () => {
    const allIn = docs.map((d) => (d.isOutput ? d : { ...d, received: true }));
    expect(deriveCaseStatus({ jobStatus: "IN_PROGRESS", docs: allIn, stages, latestSubmission: null })).toBe("PREPARING");
    const atSubmission = stages.map((s) => ({ ...s, status: s.position < 2 ? "DONE" : "IN_PROGRESS" }));
    expect(deriveCaseStatus({ jobStatus: "IN_PROGRESS", docs: allIn, stages: atSubmission, latestSubmission: null })).toBe("READY_FOR_SUBMISSION");
  });
  it("follows the latest submission, then the output, then the job", () => {
    expect(deriveCaseStatus({ jobStatus: "WAITING", docs, stages, latestSubmission: { status: "INFO_REQUIRED" } })).toBe("INFO_REQUIRED");
    const certIn = docs.map((d) => ({ ...d, received: true }));
    expect(deriveCaseStatus({ jobStatus: "IN_PROGRESS", docs: certIn, stages, latestSubmission: { status: "APPROVED" } })).toBe("OUTPUT_RECEIVED");
    expect(deriveCaseStatus({ jobStatus: "COMPLETED", docs: certIn, stages, latestSubmission: { status: "APPROVED" } })).toBe("DELIVERED");
    expect(deriveCaseStatus({ jobStatus: "CLOSED", docs, stages, latestSubmission: null })).toBe("CLOSED");
  });
  it("labels the output by case type", () => {
    expect(caseStatusLabel("OUTPUT_RECEIVED", "TAX")).toBe("Certificate received");
    expect(caseStatusLabel("OUTPUT_RECEIVED", "IMMIGRATION")).toBe("Document received");
  });
});

describe("waived documents", () => {
  it("a waived official output no longer blocks completion", () => {
    const waived = docs.map((d) => (d.isOutput ? { ...d, waived: true } : { ...d, received: true }));
    expect(missingOutputDocuments(waived)).toEqual([]);
    const done = stages.map((s) => ({ ...s, id: s.name, requiresDocuments: false, status: "DONE" as const }));
    expect(completionBlockers({ status: "IN_PROGRESS", stages: done, docs: waived, reconcile: false, details: {} })).toEqual([]);
  });
});

describe("expiry alerts", () => {
  const now = new Date(2026, 9, 6, 14, 0);
  it("counts whole days", () => {
    expect(daysUntil(new Date(2026, 9, 7, 1, 0), now)).toBe(1);
    expect(daysUntil(new Date(2026, 9, 5), now)).toBe(-1);
  });
  it("alerts at 30, 7 and 0 days", () => {
    expect(expiryThreshold(new Date(2026, 11, 31), now)).toBeNull();
    expect(expiryThreshold(new Date(2026, 10, 1), now)).toBe(30);
    expect(expiryThreshold(new Date(2026, 9, 12), now)).toBe(7);
    expect(expiryThreshold(new Date(2026, 9, 6), now)).toBe(0);
    expect(expiryThreshold(new Date(2026, 8, 1), now)).toBe(0);
  });
  it("classifies expiry state", () => {
    expect(expiryState(new Date(2026, 9, 1), now)).toBe("EXPIRED");
    expect(expiryState(new Date(2026, 9, 20), now)).toBe("EXPIRES_SOON");
    expect(expiryState(new Date(2026, 10, 25), now)).toBe("UPCOMING");
    expect(expiryState(new Date(2027, 5, 1), now)).toBe("VALID");
  });
  it("recognises expiry fields", () => {
    expect(isExpiryField({ key: "passportExpiry", type: "date" })).toBe(true);
    expect(isExpiryField({ key: "expiryDate", type: "date" })).toBe(true);
    expect(isExpiryField({ key: "submissionDate", type: "date" })).toBe(false);
    expect(isExpiryField({ key: "expiryNotes", type: "text" })).toBe(false);
  });
});

import { STAGE_EVENTS, stagesToAutoComplete } from "./case-status";

describe("case events advance the workflow", () => {
  const tax = ["Ministry submission", "Ministry review", "Follow-up", "Approval / rejection", "Certificate collection", "Client delivery"].map((name, i) => ({
    id: String(i),
    name,
    position: i,
    status: i === 0 ? "IN_PROGRESS" : "PENDING",
  }));
  it("a submission completes the submission stage only", () => {
    expect(stagesToAutoComplete(tax, STAGE_EVENTS.SUBMITTED).map((s) => s.name)).toEqual(["Ministry submission"]);
  });
  it("a decision completes review, follow-up and decision stages", () => {
    const after = tax.map((s) => ({ ...s, status: s.position === 0 ? "DONE" : s.position === 1 ? "IN_PROGRESS" : "PENDING" }));
    expect(stagesToAutoComplete(after, STAGE_EVENTS.DECIDED).map((s) => s.name)).toEqual(["Ministry review", "Follow-up", "Approval / rejection"]);
  });
  it("never jumps ahead of a non-matching current stage", () => {
    const early = [{ id: "a", name: "Application preparation", position: 0, status: "IN_PROGRESS" }, ...tax.map((s) => ({ ...s, position: s.position + 1, status: "PENDING" }))];
    expect(stagesToAutoComplete(early, STAGE_EVENTS.SUBMITTED)).toEqual([]);
  });
});
