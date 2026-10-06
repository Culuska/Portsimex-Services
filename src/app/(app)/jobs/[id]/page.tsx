import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { isFullAccessRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { detailsOf, financialsOf, jobFinanceSelect } from "@/lib/jobs";
import { isExpenseBilled, isIssued, type InvoiceStatus } from "@/lib/job-finance";
import {
  closureBlockers,
  completionBlockers,
  currentStage,
  isJobActive,
  missingOutputDocuments,
  missingRequiredDocuments,
  reconcileQuantities,
  slaState,
} from "@/lib/job-rules";
import { parseFields, SERVICE_CATEGORY_LABELS } from "@/lib/service-templates";
import { activeAgencies } from "@/lib/agencies";
import { caseStatusLabel, deriveCaseStatus } from "@/lib/case-status";
import { expiryState } from "@/lib/reminder-rules";
import SubmissionsCard from "./SubmissionsCard";
import { unwaiveDocumentAction, waiveDocumentAction } from "../case-actions";
import { Badge, Card, PageHeader } from "@/components/ui";
import SimpleActionButton from "@/components/SimpleActionButton";
import ActionForm, { fieldClass } from "@/components/ActionForm";
import {
  addDocumentAction,
  addTaskAction,
  cancelJobAction,
  completeStageAction,
  invoiceJobAction,
  moveJobAction,
  receiveDocumentAction,
  setTaskStatusAction,
  skipStageAction,
  unreceiveDocumentAction,
  updateJobAction,
} from "../actions";

const btn = "rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-60";
const btnPrimary = "rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60";
const btnGreen = "rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60";
const btnSmall = "rounded border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 disabled:opacity-60";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !["ADMIN", "SUPERVISOR", "STAFF"].includes(session.user.role)) redirect("/");
  const { id } = await params;

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      client: true,
      service: true,
      responsible: true,
      serviceRequest: true,
      shipment: true,
      stages: { orderBy: { position: "asc" }, include: { completedBy: true } },
      documents: { orderBy: [{ isOutput: "asc" }, { required: "desc" }, { name: "asc" }], include: { receivedBy: true } },
      tasks: { orderBy: [{ status: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }], include: { assignee: true } },
      submissions: {
        orderBy: { submittedAt: "desc" },
        include: { agency: true, officer: true, followUps: { orderBy: { followedUpAt: "desc" }, include: { by: true } } },
      },
      ...jobFinanceSelect,
    },
  });
  if (!job) notFound();

  const isCase = job.service.category === "GOVERNMENT_TAX" || job.service.category === "IMMIGRATION" || job.submissions.length > 0;
  const [costRows, lineRows, users, draftInvoices, shipments, history, agencies] = await Promise.all([
    prisma.expense.findMany({
      where: { jobId: id },
      orderBy: { incurredAt: "desc" },
      include: { category: true, vendor: true, invoiceItem: { include: { invoice: true } } },
    }),
    prisma.invoiceItem.findMany({ where: { jobId: id }, include: { invoice: true }, orderBy: { invoice: { issueDate: "desc" } } }),
    prisma.user.findMany({ where: { active: true, role: { in: ["ADMIN", "SUPERVISOR", "STAFF"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.invoice.findMany({ where: { clientId: job.clientId, status: "DRAFT" }, orderBy: { createdAt: "desc" }, select: { id: true, invoiceNumber: true } }),
    prisma.shipment.findMany({ where: { clientId: job.clientId }, orderBy: { createdAt: "desc" }, select: { id: true, reference: true } }),
    prisma.auditLog.findMany({ where: { jobId: id }, orderBy: { createdAt: "desc" }, take: 50 }),
    isCase ? activeAgencies() : Promise.resolve([]),
  ]);
  const caseKind = job.service.category === "IMMIGRATION" ? "IMMIGRATION" : job.service.jobPrefix === "TAX" ? "TAX" : "GOVERNMENT";
  const caseStatus = isCase
    ? deriveCaseStatus({ jobStatus: job.status, docs: job.documents, stages: job.stages, latestSubmission: job.submissions[0] ?? null })
    : null;

  const isManager = isFullAccessRole(session.user.role);
  const fin = financialsOf(job);
  const details = detailsOf(job.details);
  const fields = parseFields(job.service.fields);
  const stage = currentStage(job.stages);
  const missingDocs = missingRequiredDocuments(job.documents);
  const missingOutput = missingOutputDocuments(job.documents);
  const sla = slaState(job);
  const active = isJobActive(job.status);
  const recon = job.service.reconcileQuantities ? reconcileQuantities(details) : null;
  const toComplete = active
    ? completionBlockers({ status: job.status, stages: job.stages, docs: job.documents, reconcile: job.service.reconcileQuantities, details })
    : [];
  const toClose =
    job.status === "COMPLETED"
      ? closureBlockers({ status: job.status, unbilledBillableCosts: fin.unbilledBillableCosts, invoicedTotal: fin.invoiced, outstanding: fin.outstanding, draftInvoiceLines: fin.draftLines })
      : [];
  const unbilled = costRows.filter(
    (e) => e.billingType !== "NON_BILLABLE" && e.status !== "REJECTED" && !isExpenseBilled((e.invoiceItem?.invoice.status as InvoiceStatus | undefined) ?? null),
  );
  const issuedLines = lineRows.filter((l) => isIssued(l.invoice.status as InvoiceStatus));
  const allPaid = issuedLines.length > 0 && fin.outstanding <= 0.005;

  const timeline: { label: string; state: "done" | "current" | "pending" | "skipped"; meta?: string }[] = [
    { label: "Service request received", state: "done", meta: formatDate(job.serviceRequest?.requestDate ?? job.createdAt) },
    ...job.stages.map((s) => ({
      label: s.name,
      state: (s.status === "DONE" ? "done" : s.status === "SKIPPED" ? "skipped" : s.id === stage?.id && active ? "current" : "pending") as "done" | "current" | "pending" | "skipped",
      meta: s.completedAt ? `${formatDate(s.completedAt)}${s.completedBy ? ` · ${s.completedBy.name}` : ""}` : undefined,
    })),
    { label: "Official output received", state: missingOutput.length === 0 && job.documents.some((d) => d.isOutput) ? "done" : "pending" },
    { label: "Invoiced", state: fin.invoiced > 0 && fin.unbilledBillableCosts === 0 ? "done" : fin.invoiced > 0 || fin.draftLines > 0 ? "current" : "pending", meta: fin.invoiced > 0 ? formatCurrency(fin.invoiced) : undefined },
    { label: "Paid", state: allPaid ? "done" : fin.paid > 0 ? "current" : "pending", meta: fin.paid > 0 ? formatCurrency(fin.paid) : undefined },
    { label: "Closed", state: job.status === "CLOSED" ? "done" : "pending", meta: job.closedAt ? formatDate(job.closedAt) : undefined },
  ];

  return (
    <div>
      <PageHeader
        title={job.jobNumber}
        description={`${job.title} · ${job.service.name} (${SERVICE_CATEGORY_LABELS[job.service.category]})`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {caseStatus && (
              <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800 dark:bg-violet-900/40 dark:text-violet-300">
                Case: {caseStatusLabel(caseStatus, caseKind)}
              </span>
            )}
            <Badge status={job.priority} />
            {sla !== "NO_SLA" && <Badge status={sla} />}
            <Badge status={job.status} />
          </div>
        }
      />

      {job.status === "CANCELLED" && (
        <p className="mb-4 rounded-md bg-zinc-100 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          Cancelled {formatDate(job.cancelledAt)}: {job.cancelReason}
        </p>
      )}
      {active && missingDocs.length > 0 && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          DOCUMENTATION INCOMPLETE -- missing: {missingDocs.map((d) => d.name).join(", ")}
        </p>
      )}

      {/* Status actions */}
      <div className="mb-6 flex flex-wrap items-start gap-2">
        {job.status === "OPEN" && <SimpleActionButton action={moveJobAction.bind(null, job.id, "START")} label="Start work" className={btnPrimary} />}
        {(job.status === "OPEN" || job.status === "IN_PROGRESS") && <SimpleActionButton action={moveJobAction.bind(null, job.id, "WAIT")} label="Put on hold (waiting)" className={btn} />}
        {job.status === "WAITING" && <SimpleActionButton action={moveJobAction.bind(null, job.id, "RESUME")} label="Resume" className={btnPrimary} />}
        {(job.status === "IN_PROGRESS" || job.status === "WAITING") && (
          <SimpleActionButton action={moveJobAction.bind(null, job.id, "COMPLETE")} label="Mark completed" className={btnGreen} confirmMessage="Mark this job as completed?" />
        )}
        {job.status === "COMPLETED" && isManager && (
          <>
            <SimpleActionButton action={moveJobAction.bind(null, job.id, "CLOSE")} label="Close job" className={btnGreen} confirmMessage="Close this job? Closed jobs can't be reopened." />
            <SimpleActionButton action={moveJobAction.bind(null, job.id, "REOPEN")} label="Reopen" className={btn} />
          </>
        )}
        {isManager && (active || job.status === "OPEN") && (
          <details className="relative">
            <summary className={`${btn} cursor-pointer list-none text-red-700 dark:text-red-400`}>Cancel job…</summary>
            <div className="absolute z-10 mt-2 w-72 rounded-md border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
              <ActionForm action={cancelJobAction.bind(null, job.id)} submitLabel="Cancel job" confirmMessage="Cancel this job?">
                <input name="reason" required placeholder="Reason" className={fieldClass} />
              </ActionForm>
            </div>
          </details>
        )}
      </div>
      {(toComplete.length > 0 || toClose.length > 0) && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-medium">{toClose.length > 0 ? "Before this job can be closed:" : "Before this job can be completed:"}</p>
          <ul className="mt-1 list-disc pl-5">
            {(toClose.length > 0 ? toClose : toComplete).map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          {/* Timeline */}
          <Card>
            <h2 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">Workflow</h2>
            <ol className="flex flex-col">
              {timeline.map((t, i) => {
                const st = job.stages.find((s) => s.name === t.label && t.state === "current");
                return (
                  <li key={`${t.label}-${i}`} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${
                          t.state === "done"
                            ? "bg-emerald-500 text-white"
                            : t.state === "current"
                              ? "bg-brand-600 text-white ring-4 ring-brand-100 dark:ring-brand-900/50"
                              : t.state === "skipped"
                                ? "bg-zinc-300 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                                : "border-2 border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950"
                        }`}
                      >
                        {t.state === "done" ? "✓" : t.state === "skipped" ? "–" : t.state === "current" ? "•" : ""}
                      </span>
                      {i < timeline.length - 1 && <span className="w-px flex-1 bg-zinc-200 dark:bg-zinc-800" />}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className={`text-sm ${t.state === "current" ? "font-semibold text-zinc-900 dark:text-zinc-50" : t.state === "pending" ? "text-zinc-400" : "text-zinc-700 dark:text-zinc-300"}`}>
                        {t.label}
                        {st?.requiresDocuments && <span className="ml-2 text-xs font-normal text-zinc-500">(needs complete documents)</span>}
                      </p>
                      {t.meta && <p className="text-xs text-zinc-500">{t.meta}</p>}
                      {st && (
                        <div className="mt-2 flex flex-wrap items-start gap-2">
                          <ActionForm action={completeStageAction.bind(null, job.id, st.id)} submitLabel="Complete stage" className="flex flex-wrap items-start gap-2" buttonClassName={btnPrimary}>
                            <input name="note" placeholder="Note (optional)" className={fieldClass} />
                          </ActionForm>
                          {isManager && <SimpleActionButton action={skipStageAction.bind(null, job.id, st.id)} label="Skip" className={btn} confirmMessage={`Skip "${st.name}"?`} />}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          {/* Documents */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Document checklist</h2>
              <span className={`text-xs font-semibold ${missingDocs.length === 0 ? "text-emerald-600" : "text-red-600"}`}>
                {missingDocs.length === 0 ? "Supporting documents complete" : `${missingDocs.length} required missing`}
              </span>
            </div>
            <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
              {job.documents.map((d) => (
                <li key={d.id} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm text-zinc-900 dark:text-zinc-50">
                        <span className={d.received ? "text-emerald-600" : d.waived ? "text-zinc-400" : d.required ? "text-red-500" : "text-zinc-400"}>{d.received ? "✓" : d.waived ? "–" : "○"}</span>{" "}
                        {d.name}
                        {d.isOutput && <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800 dark:bg-violet-900/40 dark:text-violet-300">OFFICIAL OUTPUT</span>}
                        {!d.required && <span className="ml-2 text-xs text-zinc-400">optional</span>}
                        {d.received && d.expiryDate && expiryState(d.expiryDate) !== "VALID" && (
                          <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold ${expiryState(d.expiryDate) === "EXPIRED" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"}`}>
                            {expiryState(d.expiryDate) === "EXPIRED" ? "EXPIRED" : "EXPIRES SOON"}
                          </span>
                        )}
                      </p>
                      {d.waived && <p className="text-xs text-zinc-500">Waived by a manager: {d.waivedReason}</p>}
                      {d.received && (
                        <p className="text-xs text-zinc-500">
                          Received {formatDate(d.receivedAt)}
                          {d.receivedBy ? ` by ${d.receivedBy.name}` : ""}
                          {d.reference ? ` · ref ${d.reference}` : ""}
                          {d.expiryDate ? ` · expires ${formatDate(d.expiryDate)}` : ""}
                          {d.fileUrl && (
                            <>
                              {" · "}
                              <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">{d.fileName ?? "file"}</a>
                            </>
                          )}
                        </p>
                      )}
                    </div>
                    {(active || job.status === "COMPLETED") &&
                      (d.received ? (
                        active && <SimpleActionButton action={unreceiveDocumentAction.bind(null, job.id, d.id)} label="Undo" className={btnSmall} />
                      ) : d.waived ? (
                        active && isManager && <SimpleActionButton action={unwaiveDocumentAction.bind(null, job.id, d.id)} label="Remove waiver" className={btnSmall} />
                      ) : (
                        <div className="flex items-start gap-2">
                        {active && isManager && (
                          <details>
                            <summary className={`${btnSmall} cursor-pointer list-none`}>Waive…</summary>
                            <div className="mt-2 w-64">
                              <ActionForm action={waiveDocumentAction.bind(null, job.id, d.id)} submitLabel="Waive document" confirmMessage={`Waive "${d.name}"?`}>
                                <input name="reason" required placeholder="Reason (e.g. application rejected)" className={fieldClass} />
                              </ActionForm>
                            </div>
                          </details>
                        )}
                        <details>
                          <summary className={`${btnSmall} cursor-pointer list-none`}>Mark received…</summary>
                          <div className="mt-2 w-72">
                            <ActionForm action={receiveDocumentAction.bind(null, job.id, d.id)} submitLabel="Record as received">
                              <input type="file" name="file" className="text-xs" />
                              <input name="reference" placeholder="Reference / number (optional)" className={fieldClass} />
                              <label className="text-xs text-zinc-500">Expiry date (optional)<input type="date" name="expiryDate" className={`${fieldClass} mt-1 w-full`} /></label>
                            </ActionForm>
                          </div>
                        </details>
                        </div>
                      ))}
                  </div>
                </li>
              ))}
            </ul>
            {active && (
              <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <ActionForm action={addDocumentAction.bind(null, job.id)} submitLabel="Add to checklist" className="flex flex-wrap items-center gap-2">
                  <input name="name" required placeholder="Other document" className={fieldClass} />
                  <label className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400"><input type="checkbox" name="required" defaultChecked /> required</label>
                </ActionForm>
              </div>
            )}
          </Card>

          {isCase && (
            <SubmissionsCard
              jobId={job.id}
              active={active}
              docsComplete={missingDocs.length === 0}
              submissions={job.submissions}
              agencies={agencies}
              users={users}
              receivedDocs={job.documents.filter((d) => d.received && !d.isOutput).map((d) => d.name)}
              defaultOfficerId={job.responsibleId}
            />
          )}

          {/* Tasks */}
          <Card>
            <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">Tasks</h2>
            <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
              {job.tasks.map((t) => {
                const late = t.dueDate && t.status !== "DONE" && t.status !== "CANCELLED" && t.dueDate < new Date(new Date().setHours(0, 0, 0, 0));
                return (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div>
                      <p className={`text-sm ${t.status === "DONE" || t.status === "CANCELLED" ? "text-zinc-400 line-through" : "text-zinc-900 dark:text-zinc-50"}`}>{t.title}</p>
                      <p className={`text-xs ${late ? "font-medium text-red-600" : "text-zinc-500"}`}>
                        {t.assignee?.name ?? "Unassigned"} · due {formatDate(t.dueDate)}
                        {late ? " · overdue" : ""}
                        {t.completedAt ? ` · done ${formatDate(t.completedAt)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.priority !== "NORMAL" && <Badge status={t.priority} />}
                      {t.status === "TODO" && (active || job.status === "COMPLETED") && <SimpleActionButton action={setTaskStatusAction.bind(null, job.id, t.id, "IN_PROGRESS")} label="Start" className={btnSmall} />}
                      {(t.status === "TODO" || t.status === "IN_PROGRESS") && (active || job.status === "COMPLETED") && <SimpleActionButton action={setTaskStatusAction.bind(null, job.id, t.id, "DONE")} label="Done" className={btnSmall} />}
                      {t.status === "DONE" && active && <SimpleActionButton action={setTaskStatusAction.bind(null, job.id, t.id, "TODO")} label="Reopen" className={btnSmall} />}
                      <Badge status={t.status} />
                    </div>
                  </li>
                );
              })}
            </ul>
            {(active || job.status === "COMPLETED") && (
              <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <ActionForm action={addTaskAction.bind(null, job.id)} submitLabel="Add task" className="flex flex-wrap items-center gap-2">
                  <input name="title" required placeholder="New task" className={`${fieldClass} min-w-[200px] flex-1`} />
                  <select name="assigneeId" defaultValue={job.responsibleId ?? ""} className={fieldClass}>
                    <option value="">Unassigned</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <input type="date" name="dueDate" className={fieldClass} />
                  <select name="priority" defaultValue="NORMAL" className={fieldClass}>
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </ActionForm>
              </div>
            )}
          </Card>

          {/* Costs & billing */}
          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Costs</h2>
              {job.status !== "CLOSED" && job.status !== "CANCELLED" && (
                <Link href={`/expenses/new?jobId=${job.id}`} className={btnPrimary}>Record a cost</Link>
              )}
            </div>
            {costRows.length === 0 ? (
              <p className="text-sm text-zinc-500">No costs recorded against this job yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="text-zinc-500">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Cost</th>
                      <th className="px-3 py-1 font-medium">Billing</th>
                      <th className="px-3 py-1 text-right font-medium">Amount</th>
                      <th className="px-3 py-1 text-right font-medium">Markup</th>
                      <th className="px-3 py-1 font-medium">Status</th>
                      <th className="py-1 pl-3 font-medium">Billed on</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {costRows.map((e) => (
                      <tr key={e.id}>
                        <td className="py-2">
                          <Link href={`/expenses/${e.id}`} className="text-zinc-900 hover:underline dark:text-zinc-50">{e.description}</Link>
                          <p className="text-xs text-zinc-500">{e.category.name}{e.vendor ? ` · ${e.vendor.name}` : ""} · {formatDate(e.incurredAt)}</p>
                        </td>
                        <td className="px-3 py-2"><Badge status={e.billingType} /></td>
                        <td className="px-3 py-2 text-right">{formatCurrency(e.amount.toString())}</td>
                        <td className="px-3 py-2 text-right text-zinc-500">{Number(e.markupAmount) > 0 ? formatCurrency(e.markupAmount.toString()) : "—"}</td>
                        <td className="px-3 py-2"><Badge status={e.status} /></td>
                        <td className="py-2 pl-3 text-xs">
                          {e.invoiceItem ? (
                            <Link href={`/invoices/${e.invoiceItem.invoice.id}`} className="text-brand-600 hover:underline">{e.invoiceItem.invoice.invoiceNumber}</Link>
                          ) : e.billingType === "NON_BILLABLE" ? (
                            <span className="text-zinc-400">company cost</span>
                          ) : (
                            <span className="font-medium text-amber-600">not yet billed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">Billing</h2>
            {lineRows.length > 0 && (
              <ul className="mb-4 flex flex-col divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
                {lineRows.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="text-zinc-700 dark:text-zinc-300">{l.description}</span>
                    <span className="flex items-center gap-3">
                      <Link href={`/invoices/${l.invoice.id}`} className="text-xs text-brand-600 hover:underline">{l.invoice.invoiceNumber}</Link>
                      <Badge status={l.invoice.status} />
                      <span className="font-medium">{formatCurrency(Number(l.quantity) * Number(l.unitPrice))}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {job.status !== "CLOSED" && job.status !== "CANCELLED" ? (
              <ActionForm action={invoiceJobAction.bind(null, job.id)} submitLabel="Add to invoice" className="flex flex-col gap-3">
                {unbilled.length > 0 && (
                  <fieldset className="flex flex-col gap-1.5">
                    <legend className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">Re-charge billable costs</legend>
                    {unbilled.map((e) => (
                      <label key={e.id} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                        <input type="checkbox" name="expenseIds" value={e.id} defaultChecked />
                        {e.description} -- {formatCurrency(e.amount.toString())}
                        {e.billingType === "BILLABLE_WITH_MARKUP" && Number(e.markupAmount) > 0 && (
                          <span className="text-xs text-violet-600"> + {formatCurrency(e.markupAmount.toString())} fee</span>
                        )}
                      </label>
                    ))}
                  </fieldset>
                )}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_160px]">
                  <input name="feeDescription" placeholder={`${job.service.name} -- service fee (${job.jobNumber})`} className={fieldClass} />
                  <input name="feeAmount" type="number" min="0" step="0.01" placeholder="Service fee" defaultValue={fin.invoiced === 0 && fin.draftInvoiced === 0 && job.estimatedRevenue ? Number(job.estimatedRevenue) : undefined} className={fieldClass} />
                </div>
                <select name="target" defaultValue="new" className={fieldClass}>
                  <option value="new">New draft invoice for {job.client.name}</option>
                  {draftInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>Add to draft {inv.invoiceNumber} (one invoice, several services)</option>
                  ))}
                </select>
              </ActionForm>
            ) : (
              lineRows.length === 0 && <p className="text-sm text-zinc-500">Nothing billed.</p>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          {/* At a glance -- the questions management asks */}
          <Card>
            <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">At a glance</h2>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
              <Item label="Client"><Link href={`/clients/${job.clientId}`} className="text-brand-600 hover:underline">{job.client.name}</Link></Item>
              <Item label="Request">
                {job.serviceRequest ? <Link href={`/service-requests/${job.serviceRequest.id}`} className="text-brand-600 hover:underline">{job.serviceRequest.requestNumber}</Link> : "—"}
              </Item>
              <Item label="Handled by">{job.responsible?.name ?? "Unassigned"}</Item>
              <Item label="Stage">{job.status === "CLOSED" ? "Closed" : (stage?.name ?? (job.status === "COMPLETED" ? "Completed" : "—"))}</Item>
              <Item label="Started">{formatDate(job.startDate)}</Item>
              <Item label="Due">{formatDate(job.dueDate)}</Item>
              <Item label="Documents missing">{missingDocs.length + missingOutput.length === 0 ? "None" : String(missingDocs.length + missingOutput.length)}</Item>
              {recon && <Item label="Reconciliation">{`${recon.processed} + ${recon.failed} of ${recon.requested}`}{recon.balanced ? " ✓" : ""}</Item>}
              {job.shipment && <Item label="Shipment"><Link href={`/shipments/${job.shipment.id}`} className="text-brand-600 hover:underline">{job.shipment.reference}</Link></Item>}
            </dl>
            <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <dl className="flex flex-col gap-1.5 text-sm">
                <Money label="Spent (all job costs)" value={fin.costs} />
                <Money label="Billable costs not yet invoiced" value={fin.unbilledBillableCosts + fin.unbilledMarkup} warn={fin.unbilledBillableCosts > 0} />
                <Money label="Invoiced" value={fin.invoiced} />
                {fin.draftInvoiced > 0 && <Money label="On draft invoices" value={fin.draftInvoiced} />}
                <Money label="Paid by client" value={fin.paid} />
                <Money label="Outstanding" value={fin.outstanding} warn={fin.outstanding > 0} />
                <div className="mt-1 flex items-center justify-between border-t border-zinc-100 pt-2 font-semibold dark:border-zinc-800">
                  <dt>Gross profit</dt>
                  <dd className={fin.grossProfit < 0 ? "text-red-600" : "text-emerald-600"}>
                    {formatCurrency(fin.grossProfit)}
                    {fin.marginPercent !== null && <span className="ml-1 text-xs font-normal text-zinc-500">({fin.marginPercent}%)</span>}
                  </dd>
                </div>
                {(job.estimatedRevenue || job.estimatedCost) && (
                  <p className="text-xs text-zinc-500">
                    Estimate: revenue {job.estimatedRevenue ? formatCurrency(job.estimatedRevenue.toString()) : "—"}, cost {job.estimatedCost ? formatCurrency(job.estimatedCost.toString()) : "—"}
                  </p>
                )}
              </dl>
            </div>
          </Card>

          {/* Details */}
          <Card>
            <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">Job details</h2>
            {job.service.category === "IMMIGRATION" && (
              <p className="mb-3 rounded bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-900">
                Portsimex provides administrative and document support only. Decisions are made by the immigration authorities.
              </p>
            )}
            <ActionForm action={updateJobAction.bind(null, job.id)} submitLabel="Save details" keepValues readOnly={job.status === "CLOSED" || job.status === "CANCELLED"}>
              <Labeled label="Title"><input name="title" required defaultValue={job.title} className={fieldClass} /></Labeled>
              <div className="grid grid-cols-2 gap-2">
                <Labeled label="Responsible">
                  <select name="responsibleId" defaultValue={job.responsibleId ?? ""} className={fieldClass}>
                    <option value="">Unassigned</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </Labeled>
                <Labeled label="Priority">
                  <select name="priority" defaultValue={job.priority} className={fieldClass}>
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </Labeled>
                <Labeled label="Due date"><input type="date" name="dueDate" defaultValue={job.dueDate?.toISOString().slice(0, 10)} className={fieldClass} /></Labeled>
                <Labeled label="Linked shipment">
                  <select name="shipmentId" defaultValue={job.shipmentId ?? ""} className={fieldClass}>
                    <option value="">None</option>
                    {shipments.map((s) => <option key={s.id} value={s.id}>{s.reference}</option>)}
                  </select>
                </Labeled>
                <Labeled label="Est. revenue"><input type="number" min="0" step="0.01" name="estimatedRevenue" defaultValue={job.estimatedRevenue?.toString()} className={fieldClass} /></Labeled>
                <Labeled label="Est. cost"><input type="number" min="0" step="0.01" name="estimatedCost" defaultValue={job.estimatedCost?.toString()} className={fieldClass} /></Labeled>
              </div>
              {fields.length > 0 && <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{job.service.name}</p>}
              <div className="grid grid-cols-2 gap-2">
                {fields.map((f) => {
                  const v = details[f.key];
                  const value = v === null || v === undefined ? "" : String(v);
                  return (
                    <Labeled key={f.key} label={f.label} wide={f.type === "textarea"}>
                      {f.type === "textarea" ? (
                        <textarea name={`field_${f.key}`} defaultValue={value} rows={3} className={fieldClass} />
                      ) : f.type === "select" ? (
                        <select name={`field_${f.key}`} defaultValue={value} className={fieldClass}>
                          <option value="">—</option>
                          {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input name={`field_${f.key}`} type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} step={f.type === "number" ? "any" : undefined} defaultValue={value} className={fieldClass} />
                      )}
                    </Labeled>
                  );
                })}
              </div>
            </ActionForm>
            {job.description && <p className="mt-4 whitespace-pre-wrap border-t border-zinc-100 pt-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">{job.description}</p>}
          </Card>

          {/* History */}
          <Card>
            <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">History</h2>
            <ul className="flex flex-col gap-2 text-xs text-zinc-500">
              {history.map((h) => (
                <li key={h.id}>
                  <span className="text-zinc-400">{formatDate(h.createdAt)}</span> · <span className="text-zinc-700 dark:text-zinc-300">{h.actorName ?? "System"}</span>: {h.message}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="text-zinc-900 dark:text-zinc-50">{children}</dd>
    </div>
  );
}

function Money({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-zinc-500">{label}</dt>
      <dd className={warn ? "font-medium text-amber-600" : "text-zinc-900 dark:text-zinc-50"}>{formatCurrency(value)}</dd>
    </div>
  );
}

function Labeled({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 text-xs text-zinc-500 ${wide ? "col-span-2" : ""}`}>
      {label}
      {children}
    </label>
  );
}
