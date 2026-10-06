import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { isFullAccessRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { activeServices } from "@/lib/catalog";
import { formatCurrency, formatDate } from "@/lib/format";
import { allowedRequestMoves, MANAGER_ONLY } from "@/lib/request-rules";
import { SERVICE_CATEGORY_LABELS } from "@/lib/service-templates";
import { Badge, Card, PageHeader } from "@/components/ui";
import SimpleActionButton from "@/components/SimpleActionButton";
import ActionForm, { fieldClass } from "@/components/ActionForm";
import { addRequestLineAction, moveServiceRequestAction, openJobForLineAction } from "../actions";

const MOVE_LABELS: Record<string, string> = {
  SUBMITTED: "Submit",
  REVIEWED: "Mark reviewed",
  QUOTED: "Mark quoted",
  APPROVED: "Approve & open jobs",
  WAITING: "Put on hold (waiting)",
  IN_PROGRESS: "Resume",
  CANCELLED: "Cancel request",
};

export default async function ServiceRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !["ADMIN", "SUPERVISOR", "STAFF"].includes(session.user.role)) redirect("/");
  const { id } = await params;
  const [sr, services, history] = await Promise.all([
    prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        client: true,
        assignedTo: true,
        createdBy: true,
        quote: true,
        lines: { include: { service: true, job: { include: { responsible: true } } } },
      },
    }),
    activeServices(),
    prisma.auditLog.findMany({ where: { entityType: "ServiceRequest", entityId: id }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  if (!sr) notFound();
  const isManager = isFullAccessRole(session.user.role);
  const moves = allowedRequestMoves(sr.status).filter((m) => isManager || !MANAGER_ONLY.includes(m));
  const canOpenJobs = ["APPROVED", "IN_PROGRESS", "WAITING", "COMPLETED"].includes(sr.status);
  const editable = !["COMPLETED", "CLOSED", "CANCELLED"].includes(sr.status);

  return (
    <div>
      <PageHeader
        title={sr.requestNumber}
        description={`${sr.client.name} · requested ${formatDate(sr.requestDate)}${sr.createdBy ? ` · logged by ${sr.createdBy.name}` : ""}`}
        action={
          <div className="flex items-center gap-2">
            <Badge status={sr.priority} />
            <Badge status={sr.status} />
          </div>
        }
      />

      {moves.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {moves.map((m) => (
            <SimpleActionButton
              key={m}
              action={moveServiceRequestAction.bind(null, sr.id, m)}
              label={MOVE_LABELS[m] ?? m}
              confirmMessage={m === "CANCELLED" ? "Cancel this service request?" : m === "APPROVED" ? "Approve this request and open a job for each service?" : undefined}
              className={
                m === "APPROVED"
                  ? "rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                  : m === "CANCELLED"
                    ? "rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 disabled:opacity-60"
                    : "rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-60"
              }
            />
          ))}
          {["REVIEWED", "SUBMITTED"].includes(sr.status) && !sr.quote && (
            <Link href={`/quotes/new?clientId=${sr.clientId}`} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300">
              Prepare quotation
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">Services &amp; jobs</h2>
            <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
              {sr.lines.map((line) => (
                <li key={line.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{line.service.name}</p>
                    <p className="text-xs text-zinc-500">
                      {SERVICE_CATEGORY_LABELS[line.service.category]}
                      {line.notes ? ` · ${line.notes}` : ""}
                    </p>
                  </div>
                  {line.job ? (
                    <div className="flex items-center gap-3">
                      <Link href={`/jobs/${line.job.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                        {line.job.jobNumber}
                      </Link>
                      <span className="text-xs text-zinc-500">{line.job.responsible?.name ?? "unassigned"}</span>
                      <Badge status={line.job.status} />
                    </div>
                  ) : canOpenJobs && isManager ? (
                    <SimpleActionButton
                      action={openJobForLineAction.bind(null, sr.id, line.id)}
                      label="Open job"
                      className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                    />
                  ) : (
                    <span className="text-xs text-zinc-400">Job opens on approval</span>
                  )}
                </li>
              ))}
            </ul>
            {editable && (
              <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <ActionForm action={addRequestLineAction.bind(null, sr.id)} submitLabel="Add service" className="flex flex-wrap items-end gap-3">
                  <select name="serviceId" required defaultValue="" className={fieldClass}>
                    <option value="">Add another service…</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>{SERVICE_CATEGORY_LABELS[s.category]} — {s.name}</option>
                    ))}
                  </select>
                  <input name="notes" placeholder="Notes (optional)" className={fieldClass} />
                </ActionForm>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-50">Request</h2>
            <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{sr.description}</p>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
              <Item label="Client"><Link href={`/clients/${sr.clientId}`} className="text-brand-600 hover:underline">{sr.client.name}</Link></Item>
              <Item label="Requesting person">{sr.requestedByName ?? "—"}</Item>
              <Item label="Department">{sr.department ?? "—"}</Item>
              <Item label="Location">{sr.location ?? "—"}</Item>
              <Item label="Required by">{formatDate(sr.requiredBy)}</Item>
              <Item label="Assigned">{[sr.assignedDepartment, sr.assignedTo?.name].filter(Boolean).join(" · ") || "—"}</Item>
              <Item label="Estimated revenue">{sr.estimatedRevenue ? formatCurrency(sr.estimatedRevenue.toString()) : "—"}</Item>
              <Item label="Estimated cost">{sr.estimatedCost ? formatCurrency(sr.estimatedCost.toString()) : "—"}</Item>
              {sr.quote && (
                <Item label="Quotation"><Link href={`/quotes/${sr.quote.id}`} className="text-brand-600 hover:underline">{sr.quote.quoteNumber}</Link></Item>
              )}
            </dl>
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">History</h2>
            <ul className="flex flex-col gap-2 text-xs text-zinc-500">
              {history.map((h) => (
                <li key={h.id}>
                  <span className="text-zinc-400">{formatDate(h.createdAt)}</span> · {h.actorName ?? "System"}: {h.message}
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
