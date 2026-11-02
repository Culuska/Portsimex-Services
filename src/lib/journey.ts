// The one journey every piece of work follows, from the client's request to
// the money in the bank:
//   Request -> Approval -> Operations -> Billing -> Payment -> Closed
// Pure module (no app imports): given a job's (or a request's) facts it says
// which step each part is at and what the next action is, so the dashboard,
// request, job and invoice pages all tell the same story.

export const JOURNEY_STEPS = [
  { key: "request", label: "Request" },
  { key: "approval", label: "Approval" },
  { key: "operations", label: "Operations" },
  { key: "billing", label: "Billing" },
  { key: "payment", label: "Payment" },
  { key: "closed", label: "Closed" },
] as const;

export type StepKey = (typeof JOURNEY_STEPS)[number]["key"];
export type StepState = "done" | "current" | "pending" | "skipped";

export type NextAction = {
  label: string;
  /** Short explanation shown under the action. */
  hint?: string;
  /** Where on the page (or which page) the action is done. */
  href?: string;
  /** Who usually does it. */
  who: "Operations" | "Manager" | "Finance" | "Client";
};

export type Journey = {
  steps: { key: StepKey; label: string; state: StepState; detail?: string }[];
  current: StepKey;
  next: NextAction | null;
  cancelled: boolean;
};

export type JobFacts = {
  id: string;
  status: "OPEN" | "IN_PROGRESS" | "WAITING" | "COMPLETED" | "CLOSED" | "CANCELLED";
  stagesTotal: number;
  stagesDone: number;
  currentStageName: string | null;
  missingDocs: number;
  missingOutput: number;
  invoiced: number;
  draftLines: number;
  /** Billable costs + handling fees not yet on an invoice. */
  unbilled: number;
  paid: number;
  outstanding: number;
};

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const EPS = 0.005;

/** Billing is finished when something was invoiced, nothing billable is left and no lines sit on drafts. */
function billingDone(j: JobFacts) {
  return j.invoiced > EPS && j.unbilled <= EPS && j.draftLines === 0;
}

/** Which step a job is on (for pipelines and lists). */
export function jobStep(j: JobFacts): StepKey {
  if (j.status === "CLOSED") return "closed";
  if (j.status === "CANCELLED") return "closed";
  if (j.status !== "COMPLETED") return "operations";
  if (!billingDone(j)) return "billing";
  if (j.outstanding > EPS) return "payment";
  return "closed";
}

/** Completed, billed and paid -- only the closing click is left. */
export function readyToClose(j: JobFacts) {
  return j.status === "COMPLETED" && billingDone(j) && j.outstanding <= EPS;
}

export function jobJourney(j: JobFacts, opts: { hasRequest: boolean } = { hasRequest: true }): Journey {
  const cancelled = j.status === "CANCELLED";
  const step = jobStep(j);
  const order: StepKey[] = JOURNEY_STEPS.map((s) => s.key);
  const at = cancelled ? -1 : j.status === "CLOSED" ? order.length : readyToClose(j) ? order.indexOf("closed") : order.indexOf(step);
  const state = (k: StepKey): StepState => {
    if (cancelled) return k === "request" || k === "approval" ? "done" : "skipped";
    const i = order.indexOf(k);
    return i < at ? "done" : i === at ? "current" : "pending";
  };

  const opsDetail =
    j.status === "COMPLETED" || j.status === "CLOSED"
      ? "Work completed"
      : j.stagesTotal > 0
        ? `${j.stagesDone}/${j.stagesTotal} stages${j.currentStageName ? ` · ${j.currentStageName}` : ""}`
        : undefined;
  const billDetail = j.invoiced > EPS ? `${money(j.invoiced)} invoiced` : j.unbilled > EPS ? `${money(j.unbilled)} to bill` : undefined;
  const payDetail = j.invoiced > EPS ? (j.outstanding > EPS ? `${money(j.outstanding)} due` : "Paid in full") : undefined;

  const steps = JOURNEY_STEPS.map((s) => ({
    key: s.key,
    label: s.label,
    state: state(s.key),
    detail:
      s.key === "request"
        ? opts.hasRequest
          ? "Received"
          : "Opened directly"
        : s.key === "approval"
          ? "Approved"
          : s.key === "operations"
            ? opsDetail
            : s.key === "billing"
              ? billDetail
              : s.key === "payment"
                ? payDetail
                : j.status === "CLOSED"
                  ? "Closed"
                  : undefined,
  }));

  return { steps, current: cancelled ? "closed" : at >= order.length ? "closed" : order[at], next: jobNextAction(j), cancelled };
}

/** The single most useful thing to do next on a job. */
export function jobNextAction(j: JobFacts): NextAction | null {
  switch (j.status) {
    case "CANCELLED":
    case "CLOSED":
      return null;
    case "OPEN":
      return { label: "Start work", hint: "Assign the job and begin the first stage.", href: "#workflow", who: "Operations" };
    case "WAITING":
      return { label: "Follow up and resume", hint: "The job is on hold waiting for someone else.", href: "#workflow", who: "Operations" };
    case "IN_PROGRESS":
      if (j.missingDocs > 0) {
        return { label: `Collect ${j.missingDocs} missing document${j.missingDocs === 1 ? "" : "s"}`, hint: "Stages that need documents can't be completed until they arrive.", href: "#documents", who: "Operations" };
      }
      if (j.stagesDone < j.stagesTotal && j.currentStageName) {
        return { label: `Complete stage: ${j.currentStageName}`, hint: `${j.stagesDone} of ${j.stagesTotal} stages done.`, href: "#workflow", who: "Operations" };
      }
      if (j.missingOutput > 0) {
        return { label: "Record the official output", hint: "Certificate, permit or proof of delivery.", href: "#documents", who: "Operations" };
      }
      return { label: "Mark the job completed", hint: "All stages are done -- hand over to billing.", href: "#workflow", who: "Operations" };
    case "COMPLETED":
      if (j.draftLines > 0 && j.unbilled <= EPS) {
        return { label: "Issue the draft invoice", hint: "It isn't sent to the client or in the accounts until issued.", href: "#billing", who: "Finance" };
      }
      if (j.unbilled > EPS || j.invoiced <= EPS) {
        return {
          label: j.unbilled > EPS ? `Invoice the client (${money(j.unbilled)} of costs to re-charge)` : "Invoice the client",
          hint: "Add the service fee and re-charged costs to an invoice.",
          href: "#billing",
          who: "Finance",
        };
      }
      if (j.outstanding > EPS) return { label: `Collect payment (${money(j.outstanding)} due)`, hint: "Record the payment on the invoice when it arrives.", href: "#billing", who: "Finance" };
      return { label: "Close the job", hint: "Done, billed and paid.", href: "#workflow", who: "Manager" };
  }
}

// ---------------------------------------------------------------------------
// Service requests: the journey of the whole request across its jobs
// ---------------------------------------------------------------------------

export type RequestFacts = {
  status: "DRAFT" | "SUBMITTED" | "REVIEWED" | "QUOTED" | "APPROVED" | "IN_PROGRESS" | "WAITING" | "COMPLETED" | "CLOSED" | "CANCELLED";
  lines: number;
  linesWithoutJob: number;
  jobs: JobFacts[];
};

export function requestJourney(r: RequestFacts): Journey {
  const live = r.jobs.filter((j) => j.status !== "CANCELLED");
  const cancelled = r.status === "CANCELLED";
  const preApproval = ["DRAFT", "SUBMITTED", "REVIEWED", "QUOTED"].includes(r.status);
  const all = (f: (j: JobFacts) => boolean) => live.length > 0 && r.linesWithoutJob === 0 && live.every(f);
  const opsDone = all((j) => j.status === "COMPLETED" || j.status === "CLOSED");
  const billDone = opsDone && all((j) => j.status === "CLOSED" || billingDone(j));
  const payDone = billDone && all((j) => j.status === "CLOSED" || j.outstanding <= EPS);
  const closed = all((j) => j.status === "CLOSED") || r.status === "CLOSED";

  const order: StepKey[] = JOURNEY_STEPS.map((s) => s.key);
  const at = cancelled
    ? -1
    : r.status === "DRAFT"
      ? 0
      : preApproval
        ? 1
        : closed
          ? order.length
          : payDone
            ? 5
            : billDone
              ? 4
              : opsDone
                ? 3
                : 2;
  const sum = (f: (j: JobFacts) => number) => live.reduce((s, j) => s + f(j), 0);
  const invoiced = sum((j) => j.invoiced);
  const outstanding = sum((j) => j.outstanding);
  const doneJobs = live.filter((j) => j.status === "COMPLETED" || j.status === "CLOSED").length;
  const steps = JOURNEY_STEPS.map((s, i) => ({
    key: s.key,
    label: s.label,
    state: (cancelled ? (i === 0 ? "done" : "skipped") : i < at ? "done" : i === at ? "current" : "pending") as StepState,
    detail:
      s.key === "request"
        ? `${r.lines} service${r.lines === 1 ? "" : "s"}`
        : s.key === "approval"
          ? preApproval
            ? r.status === "QUOTED"
              ? "Quote sent"
              : "Waiting"
            : cancelled
              ? "Cancelled"
              : "Approved"
          : s.key === "operations"
            ? live.length
              ? `${doneJobs}/${live.length} job${live.length === 1 ? "" : "s"} done`
              : undefined
            : s.key === "billing"
              ? invoiced > EPS
                ? `${money(invoiced)} invoiced`
                : undefined
              : s.key === "payment"
                ? invoiced > EPS
                  ? outstanding > EPS
                    ? `${money(outstanding)} due`
                    : "Paid in full"
                  : undefined
                : closed
                  ? "Closed"
                  : undefined,
  }));

  let next: NextAction | null = null;
  if (!cancelled) {
    if (r.status === "DRAFT") next = { label: "Submit the request", who: "Operations" };
    else if (preApproval) {
      next =
        r.status === "QUOTED"
          ? { label: "Approve once the client accepts the quote", hint: "Approving opens a job for each service.", who: "Manager" }
          : { label: "Review and approve the request", hint: "Approving opens a job for each service. Prepare a quotation first if the client needs one.", who: "Manager" };
    } else if (r.linesWithoutJob > 0) {
      next = { label: `Open ${r.linesWithoutJob} job${r.linesWithoutJob === 1 ? "" : "s"} for the remaining services`, href: "#services", who: "Manager" };
    } else if (!closed) {
      const pending = live.filter((j) => j.status !== "CLOSED");
      // Point at the job furthest behind -- it is what holds the request up.
      const rank = (j: JobFacts) => (readyToClose(j) ? order.length : order.indexOf(jobStep(j)));
      const first = pending
        .map((j) => ({ j, a: jobNextAction(j) }))
        .filter((x) => x.a)
        .sort((x, y) => rank(x.j) - rank(y.j))[0];
      if (first?.a) next = { ...first.a, href: `/jobs/${first.j.id}${first.a.href ?? ""}`, hint: pending.length > 1 ? `${pending.length} jobs still open -- see each below.` : first.a.hint };
    }
  }
  return { steps, current: cancelled || at < 0 ? "request" : at >= order.length ? "closed" : order[at], next, cancelled };
}

// ---------------------------------------------------------------------------
// Invoices: where an invoice sits on the journey of the jobs it bills
// ---------------------------------------------------------------------------

export type InvoiceFacts = {
  status: "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED";
  total: number;
  balance: number;
  /** The jobs billed on this invoice (empty for a stand-alone invoice). */
  jobs: { id: string; jobNumber: string; status: JobFacts["status"] }[];
};

export function invoiceJourney(inv: InvoiceFacts): Journey {
  const cancelled = inv.status === "CANCELLED";
  const draft = inv.status === "DRAFT";
  const paid = !draft && inv.balance <= EPS;
  const jobsDone = inv.jobs.every((j) => j.status === "COMPLETED" || j.status === "CLOSED" || j.status === "CANCELLED");
  const jobsClosed = inv.jobs.length > 0 && inv.jobs.every((j) => j.status === "CLOSED" || j.status === "CANCELLED");
  const order: StepKey[] = JOURNEY_STEPS.map((s) => s.key);
  const at = cancelled ? -1 : draft ? 3 : !paid ? 4 : jobsClosed ? order.length : 5;
  const steps = JOURNEY_STEPS.map((s, i) => ({
    key: s.key,
    label: s.label,
    state: (cancelled ? (i < 3 ? "done" : "skipped") : s.key === "operations" && !jobsDone ? "current" : i < at ? "done" : i === at ? "current" : "pending") as StepState,
    detail:
      s.key === "operations"
        ? inv.jobs.length
          ? jobsDone
            ? "Work completed"
            : "Work still in progress"
          : "No job linked"
        : s.key === "billing"
          ? draft
            ? `Draft · ${money(inv.total)}`
            : `${money(inv.total)} issued`
          : s.key === "payment"
            ? draft
              ? undefined
              : paid
                ? "Paid in full"
                : `${money(inv.balance)} due`
            : s.key === "closed" && jobsClosed
              ? "Jobs closed"
              : undefined,
  }));
  let next: NextAction | null = null;
  if (!cancelled) {
    if (draft) next = { label: "Issue the invoice", hint: "Sends it to the client's account and records the revenue.", href: "#status", who: "Finance" };
    else if (!paid) next = { label: `Record the client's payment (${money(inv.balance)} due)`, hint: "Or apply an advance the client has already paid.", href: "#payment", who: "Finance" };
    else {
      const open = inv.jobs.find((j) => j.status === "COMPLETED");
      if (open) next = { label: `Close job ${open.jobNumber}`, hint: "Paid in full -- the job can be closed.", href: `/jobs/${open.id}#workflow`, who: "Manager" };
    }
  }
  return { steps, current: cancelled || at < 0 ? "billing" : at >= order.length ? "closed" : order[at], next, cancelled };
}
