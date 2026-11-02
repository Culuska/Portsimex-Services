import { describe, expect, it } from "vitest";
import { invoiceJourney, jobJourney, jobNextAction, jobStep, readyToClose, requestJourney, type JobFacts } from "./journey";

const job = (over: Partial<JobFacts> = {}): JobFacts => ({
  id: "j1",
  status: "IN_PROGRESS",
  stagesTotal: 4,
  stagesDone: 1,
  currentStageName: "Submit to Ministry",
  missingDocs: 0,
  missingOutput: 1,
  invoiced: 0,
  draftLines: 0,
  unbilled: 0,
  paid: 0,
  outstanding: 0,
  ...over,
});

describe("job journey", () => {
  it("places a job on the right step", () => {
    expect(jobStep(job())).toBe("operations");
    expect(jobStep(job({ status: "COMPLETED" }))).toBe("billing");
    expect(jobStep(job({ status: "COMPLETED", invoiced: 500, outstanding: 500 }))).toBe("payment");
    expect(jobStep(job({ status: "COMPLETED", invoiced: 500, unbilled: 100, outstanding: 500 }))).toBe("billing");
    expect(jobStep(job({ status: "COMPLETED", invoiced: 500 }))).toBe("closed");
    expect(readyToClose(job({ status: "COMPLETED", invoiced: 500 }))).toBe(true);
  });

  it("marks earlier steps done and the current one current", () => {
    const j = jobJourney(job({ status: "COMPLETED", invoiced: 500, outstanding: 200, paid: 300 }));
    expect(j.steps.map((s) => s.state)).toEqual(["done", "done", "done", "done", "current", "pending"]);
    expect(j.current).toBe("payment");
    expect(j.steps.find((s) => s.key === "payment")?.detail).toBe("$200.00 due");
  });

  it("a closed job has every step done; a cancelled one skips the rest", () => {
    expect(jobJourney(job({ status: "CLOSED", invoiced: 1 })).steps.every((s) => s.state === "done")).toBe(true);
    const c = jobJourney(job({ status: "CANCELLED" }));
    expect(c.cancelled).toBe(true);
    expect(c.steps.filter((s) => s.state === "skipped")).toHaveLength(4);
    expect(c.next).toBeNull();
  });

  it("suggests the next action in the order the work happens", () => {
    expect(jobNextAction(job({ status: "OPEN" }))?.label).toBe("Start work");
    expect(jobNextAction(job({ missingDocs: 2 }))?.label).toBe("Collect 2 missing documents");
    expect(jobNextAction(job())?.label).toBe("Complete stage: Submit to Ministry");
    expect(jobNextAction(job({ stagesDone: 4, currentStageName: null }))?.label).toBe("Record the official output");
    expect(jobNextAction(job({ stagesDone: 4, currentStageName: null, missingOutput: 0 }))?.label).toBe("Mark the job completed");
    expect(jobNextAction(job({ status: "COMPLETED", unbilled: 130 }))?.label).toBe("Invoice the client ($130.00 of costs to re-charge)");
    expect(jobNextAction(job({ status: "COMPLETED", invoiced: 300, draftLines: 1 }))?.label).toBe("Issue the draft invoice");
    expect(jobNextAction(job({ status: "COMPLETED", invoiced: 0, draftLines: 1 }))?.label).toBe("Issue the draft invoice");
    expect(jobNextAction(job({ status: "COMPLETED", invoiced: 300, outstanding: 300 }))?.who).toBe("Finance");
    expect(jobNextAction(job({ status: "COMPLETED", invoiced: 300 }))?.label).toBe("Close the job");
  });
});

describe("request journey", () => {
  it("waits for approval before any job exists", () => {
    const r = requestJourney({ status: "SUBMITTED", lines: 2, linesWithoutJob: 2, jobs: [] });
    expect(r.current).toBe("approval");
    expect(r.next?.who).toBe("Manager");
  });

  it("follows the slowest job and points to it", () => {
    const r = requestJourney({
      status: "IN_PROGRESS",
      lines: 2,
      linesWithoutJob: 0,
      jobs: [job({ id: "a", status: "COMPLETED", invoiced: 300, outstanding: 0 }), job({ id: "b" })],
    });
    expect(r.current).toBe("operations");
    expect(r.steps.find((s) => s.key === "operations")?.detail).toBe("1/2 jobs done");
    expect(r.next?.href).toBe("/jobs/b#workflow");
  });

  it("reaches payment once every job is billed", () => {
    const r = requestJourney({
      status: "COMPLETED",
      lines: 2,
      linesWithoutJob: 0,
      jobs: [job({ id: "a", status: "COMPLETED", invoiced: 300, outstanding: 300 }), job({ id: "b", status: "CLOSED", invoiced: 200 })],
    });
    expect(r.current).toBe("payment");
    expect(r.steps.find((s) => s.key === "payment")?.detail).toBe("$300.00 due");
  });

  it("is closed when all jobs are closed", () => {
    const r = requestJourney({ status: "COMPLETED", lines: 1, linesWithoutJob: 0, jobs: [job({ status: "CLOSED", invoiced: 100 })] });
    expect(r.steps.every((s) => s.state === "done")).toBe(true);
    expect(r.next).toBeNull();
  });
});

describe("invoice journey", () => {
  const jobs = [{ id: "j1", jobNumber: "JOB-TAX-2026-0001", status: "COMPLETED" as const }];
  it("draft -> issue; issued -> collect; paid -> close the job", () => {
    expect(invoiceJourney({ status: "DRAFT", total: 100, balance: 100, jobs }).next?.label).toBe("Issue the invoice");
    const due = invoiceJourney({ status: "SENT", total: 100, balance: 100, jobs });
    expect(due.current).toBe("payment");
    expect(due.next?.label).toBe("Record the client's payment ($100.00 due)");
    const paid = invoiceJourney({ status: "PAID", total: 100, balance: 0, jobs });
    expect(paid.next?.href).toBe("/jobs/j1#workflow");
    expect(invoiceJourney({ status: "PAID", total: 100, balance: 0, jobs: [{ ...jobs[0], status: "CLOSED" }] }).next).toBeNull();
  });
});
