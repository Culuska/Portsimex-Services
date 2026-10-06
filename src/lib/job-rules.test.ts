import { describe, expect, it } from "vitest";
import {
  assertJobTransition,
  checkCompleteStage,
  closureBlockers,
  completionBlockers,
  computeDueDate,
  currentStage,
  missingOutputDocuments,
  missingRequiredDocuments,
  reconcileQuantities,
  slaState,
} from "./job-rules";

const stages = [
  { id: "s1", position: 0, name: "Document collection", status: "DONE" as const, requiresDocuments: false },
  { id: "s2", position: 1, name: "Verification", status: "IN_PROGRESS" as const, requiresDocuments: true },
  { id: "s3", position: 2, name: "Submission", status: "PENDING" as const, requiresDocuments: false },
];
const docs = [
  { name: "Passport", required: true, isOutput: false, received: true },
  { name: "Application", required: true, isOutput: false, received: false },
  { name: "Photos", required: false, isOutput: false, received: false },
  { name: "Final visa", required: true, isOutput: true, received: false },
];

describe("documents", () => {
  it("lists only required, non-output documents as missing", () => {
    expect(missingRequiredDocuments(docs).map((d) => d.name)).toEqual(["Application"]);
  });
  it("tracks output documents separately", () => {
    expect(missingOutputDocuments(docs).map((d) => d.name)).toEqual(["Final visa"]);
  });
});

describe("stage gating", () => {
  it("finds the current stage in position order", () => {
    expect(currentStage(stages)?.id).toBe("s2");
  });
  it("blocks a document-gated stage while documents are missing", () => {
    expect(checkCompleteStage(stages[1], stages, docs, "IN_PROGRESS")).toMatch(/DOCUMENTATION INCOMPLETE.*Application/);
  });
  it("allows it once the documents are in", () => {
    const allIn = docs.map((d) => ({ ...d, received: true }));
    expect(checkCompleteStage(stages[1], stages, allIn, "IN_PROGRESS")).toBeNull();
  });
  it("forces stages to be completed in order", () => {
    expect(checkCompleteStage(stages[2], stages, docs, "IN_PROGRESS")).toMatch(/in order/);
  });
  it("refuses changes on a closed job", () => {
    expect(checkCompleteStage(stages[1], stages, docs, "CLOSED")).toMatch(/closed/);
  });
});

describe("completion", () => {
  it("cannot complete without the official output document", () => {
    const done = stages.map((s) => ({ ...s, status: "DONE" as const }));
    const supportingIn = docs.map((d) => (d.isOutput ? d : { ...d, received: true }));
    const blockers = completionBlockers({ status: "IN_PROGRESS", stages: done, docs: supportingIn, reconcile: false, details: {} });
    expect(blockers).toEqual(["Official output not yet received: Final visa."]);
  });
  it("completes when everything is in", () => {
    const done = stages.map((s) => ({ ...s, status: "DONE" as const }));
    const allIn = docs.map((d) => ({ ...d, received: true }));
    expect(completionBlockers({ status: "IN_PROGRESS", stages: done, docs: allIn, reconcile: false, details: {} })).toEqual([]);
  });
  it("requires bulk quantities to reconcile", () => {
    const done = stages.map((s) => ({ ...s, status: "DONE" as const }));
    const allIn = docs.map((d) => ({ ...d, received: true }));
    const unbalanced = { quantityRequested: 100, quantityProcessed: 95, quantityFailed: 0 };
    expect(completionBlockers({ status: "IN_PROGRESS", stages: done, docs: allIn, reconcile: true, details: unbalanced })[0]).toMatch(
      /requested 100, processed 95, failed 0/,
    );
    const balanced = { quantityRequested: 100, quantityProcessed: 95, quantityFailed: 5 };
    expect(completionBlockers({ status: "IN_PROGRESS", stages: done, docs: allIn, reconcile: true, details: balanced })).toEqual([]);
  });
});

describe("reconcileQuantities", () => {
  it("returns null until a requested quantity is entered", () => {
    expect(reconcileQuantities({})).toBeNull();
  });
  it("needs something requested", () => {
    expect(reconcileQuantities({ quantityRequested: "0" })?.balanced).toBe(false);
  });
});

describe("closure", () => {
  const ok = { status: "COMPLETED" as const, unbilledBillableCosts: 0, invoicedTotal: 500, outstanding: 0, draftInvoiceLines: 0 };
  it("closes a completed, fully billed and paid job", () => {
    expect(closureBlockers(ok)).toEqual([]);
  });
  it("blocks on unbilled costs, drafts, no invoice and outstanding balance", () => {
    expect(closureBlockers({ ...ok, unbilledBillableCosts: 100 })).toHaveLength(1);
    expect(closureBlockers({ ...ok, draftInvoiceLines: 1 })).toHaveLength(1);
    expect(closureBlockers({ ...ok, invoicedTotal: 0 })).toHaveLength(1);
    expect(closureBlockers({ ...ok, outstanding: 50 })).toHaveLength(1);
    expect(closureBlockers({ ...ok, status: "IN_PROGRESS" })).toHaveLength(1);
  });
});

describe("job transitions", () => {
  it("never reopens a closed or cancelled job", () => {
    expect(() => assertJobTransition("CLOSED", "IN_PROGRESS")).toThrow();
    expect(() => assertJobTransition("CANCELLED", "OPEN")).toThrow();
  });
  it("allows reopening a completed job", () => {
    expect(() => assertJobTransition("COMPLETED", "IN_PROGRESS")).not.toThrow();
  });
});

describe("SLA", () => {
  const now = new Date(2026, 9, 6, 15, 0);
  const at = (d: number) => new Date(2026, 9, d, 9, 0);
  it("classifies open jobs", () => {
    expect(slaState({ dueDate: at(5), completedAt: null, status: "IN_PROGRESS" }, now)).toBe("OVERDUE");
    expect(slaState({ dueDate: at(6), completedAt: null, status: "IN_PROGRESS" }, now)).toBe("DUE_TODAY");
    expect(slaState({ dueDate: at(8), completedAt: null, status: "IN_PROGRESS" }, now)).toBe("DUE_SOON");
    expect(slaState({ dueDate: at(20), completedAt: null, status: "OPEN" }, now)).toBe("ON_TRACK");
    expect(slaState({ dueDate: null, completedAt: null, status: "OPEN" }, now)).toBe("NO_SLA");
  });
  it("classifies completed jobs by the day they finished", () => {
    expect(slaState({ dueDate: at(6), completedAt: new Date(2026, 9, 6, 23, 0), status: "COMPLETED" }, now)).toBe("COMPLETED_ON_TIME");
    expect(slaState({ dueDate: at(6), completedAt: at(7), status: "CLOSED" }, now)).toBe("COMPLETED_LATE");
  });
  it("uses the earlier of SLA and client deadline", () => {
    const start = new Date(2026, 9, 1);
    expect(computeDueDate(start, 10, new Date(2026, 9, 5))?.getDate()).toBe(5);
    expect(computeDueDate(start, 2, new Date(2026, 9, 5))?.getDate()).toBe(3);
    expect(computeDueDate(start, 0, null)?.getDate()).toBe(1);
    expect(computeDueDate(start, null, null)).toBeNull();
  });
});
