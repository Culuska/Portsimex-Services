import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { invoiceBalance, invoiceGrandTotal, invoiceNetOfTax, invoicePaid } from "@/lib/invoices";
import { financialsOf, jobFinanceSelect } from "@/lib/jobs";
import { clientCredits } from "@/lib/finance";
import { SERVICE_CATEGORIES, SERVICE_CATEGORY_LABELS } from "@/lib/service-templates";
import { AGREEMENT_TYPE_LABELS, SERVICE_TYPE_LABELS } from "@/lib/services";
import ClientForm from "../ClientForm";
import NoteForm from "../NoteForm";
import FollowUpForm from "../FollowUpForm";
import { updateClientAction, toggleFollowUpAction } from "../actions";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      shipments: { orderBy: { createdAt: "desc" } },
      invoices: { orderBy: { issueDate: "desc" }, include: { items: true, payments: true } },
      serviceRequests: { orderBy: { createdAt: "desc" }, take: 20, include: { lines: { include: { service: true } } } },
      jobs: {
        orderBy: { createdAt: "desc" },
        include: { service: true, responsible: true, documents: { where: { received: true } }, ...jobFinanceSelect },
      },
      quotes: { orderBy: { issueDate: "desc" } },
      clientNotes: { orderBy: { createdAt: "desc" }, include: { author: true } },
      followUps: { orderBy: { dueDate: "asc" } },
      serviceRates: true,
    },
  });

  if (!client) notFound();

  // 360° financials across everything billed and spent for this client.
  const costs = await prisma.expense.aggregate({
    where: {
      status: { not: "REJECTED" },
      OR: [{ clientId: client.id }, { job: { clientId: client.id } }, { shipment: { clientId: client.id } }],
    },
    _sum: { amount: true },
  });
  const issued = client.invoices.filter((i) => !["DRAFT", "CANCELLED"].includes(i.status));
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  const revenue = issued.reduce((s, i) => s + invoiceNetOfTax(i), 0);
  const paid = issued.reduce((s, i) => s + Math.min(invoicePaid(i.payments), invoiceGrandTotal(i)), 0);
  const overdue = issued
    .filter((i) => i.dueDate < today)
    .reduce((s, i) => s + Math.max(invoiceBalance(i), 0), 0);
  const outstanding = issued.reduce((s, i) => s + Math.max(invoiceBalance(i), 0), 0);
  const credit = (await clientCredits(prisma, client.id)).reduce((s, c) => s + c.remaining, 0);
  const directCosts = Number(costs._sum.amount ?? 0);
  const grossProfit = revenue - directCosts;
  const margin = revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : null;
  const jobsByCategory = SERVICE_CATEGORIES.map((c) => ({
    category: c,
    total: client.jobs.filter((j) => j.service.category === c).length,
    open: client.jobs.filter((j) => j.service.category === c && ["OPEN", "IN_PROGRESS", "WAITING"].includes(j.status)).length,
  })).filter((r) => r.total > 0);
  const documents = client.jobs.flatMap((j) => j.documents.map((d) => ({ ...d, jobNumber: j.jobNumber, jobId: j.id })));

  const boundUpdate = updateClientAction.bind(null, client.id);
  const serviceRates = Object.fromEntries(
    client.serviceRates.map((r) => [r.serviceType, r.markupPercent.toString()]),
  );

  return (
    <div>
      <PageHeader
        title={client.name}
        description={`Client 360° · Code ${client.mnemonic} · ${client.clientType.replace(/_/g, " ").toLowerCase()}${client.contactPerson ? ` · ${client.contactPerson}` : ""}${client.paymentTermsDays !== null ? ` · net ${client.paymentTermsDays} days` : ""}`}
        action={
          <div className="flex items-center gap-3">
            <Link href={`/finance/reports/statement?client=${client.id}&from=${new Date().getFullYear()}-01-01`} className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
              Statement
            </Link>
            <Link href={`/finance/advances?client=${client.id}`} className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
              Advances
            </Link>
            <ButtonLink href={`/service-requests/new?clientId=${client.id}`}>New service request</ButtonLink>
            <Badge status={client.stage} />
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-7">
        <StatCard label="Total revenue" value={formatCurrency(revenue)} hint="issued invoices" />
        <StatCard label="Direct costs" value={formatCurrency(directCosts)} />
        <StatCard label="Gross profit" value={formatCurrency(grossProfit)} hint={margin !== null ? `${margin}% margin` : undefined} />
        <StatCard label="Paid" value={formatCurrency(paid)} />
        <StatCard label="Outstanding" value={formatCurrency(outstanding)} hint={client.creditLimit ? `limit ${formatCurrency(client.creditLimit.toString())}` : undefined} />
        <StatCard label="Overdue" value={formatCurrency(overdue)} />
        <StatCard label="Advance / credit" value={formatCurrency(credit)} hint="unused deposits" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">Services used</h2>
          {jobsByCategory.length === 0 ? (
            <EmptyState message="No jobs yet for this client." />
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
              {jobsByCategory.map((r) => (
                <li key={r.category} className="flex justify-between py-2">
                  <span className="text-zinc-700 dark:text-zinc-300">{SERVICE_CATEGORY_LABELS[r.category]}</span>
                  <span className="text-zinc-500">
                    {r.total} job{r.total > 1 ? "s" : ""}
                    {r.open > 0 && <span className="ml-1 text-brand-600">({r.open} open)</span>}
                  </span>
                </li>
              ))}
              {client.shipments.length > 0 && (
                <li className="flex justify-between py-2">
                  <span className="text-zinc-700 dark:text-zinc-300">Shipments</span>
                  <span className="text-zinc-500">{client.shipments.length}</span>
                </li>
              )}
            </ul>
          )}
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">Jobs / cases</h2>
          {client.jobs.length === 0 ? (
            <EmptyState message="No jobs yet -- log a service request to start one." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-zinc-500">
                  <tr>
                    <th className="py-1 font-medium">Job</th>
                    <th className="py-1 font-medium">Service</th>
                    <th className="px-3 py-1 text-right font-medium">Invoiced</th>
                    <th className="px-3 py-1 text-right font-medium">Profit</th>
                    <th className="py-1 pl-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {client.jobs.map((j) => {
                    const f = financialsOf(j);
                    return (
                      <tr key={j.id}>
                        <td className="py-2">
                          <Link href={`/jobs/${j.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">{j.jobNumber}</Link>
                          <p className="text-xs text-zinc-500">{j.responsible?.name ?? "unassigned"}</p>
                        </td>
                        <td className="py-2 text-zinc-500">{j.service.name}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(f.invoiced)}</td>
                        <td className={`px-3 py-2 text-right ${f.grossProfit < 0 ? "text-red-600" : ""}`}>{formatCurrency(f.grossProfit)}</td>
                        <td className="py-2 pl-3"><Badge status={j.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card>
            <details>
              <summary className="cursor-pointer font-semibold text-zinc-900 dark:text-zinc-50">Edit client details</summary>
              <div className="mt-4">
                <ClientForm
                  action={boundUpdate}
                  defaultValues={{ ...client, creditLimit: client.creditLimit?.toString() ?? null, serviceRates }}
                  submitLabel="Save changes"
                />
              </div>
            </details>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-3 text-sm dark:border-zinc-800">
              <div><dt className="text-xs text-zinc-500">Email</dt><dd>{client.email ?? "—"}</dd></div>
              <div><dt className="text-xs text-zinc-500">Phone</dt><dd>{client.phone ?? "—"}</dd></div>
              <div><dt className="text-xs text-zinc-500">Department</dt><dd>{client.department ?? "—"}</dd></div>
              <div><dt className="text-xs text-zinc-500">Country</dt><dd>{client.country ?? "—"}</dd></div>
              <div><dt className="text-xs text-zinc-500">Tax / registration</dt><dd>{client.taxNumber ?? "—"}</dd></div>
              <div><dt className="text-xs text-zinc-500">Currency</dt><dd>{client.currency}</dd></div>
            </dl>
          </Card>

          <Card>
            <h2 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
              Agreement
            </h2>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Type</dt>
                <dd>
                  {client.agreementType
                    ? AGREEMENT_TYPE_LABELS[client.agreementType]
                    : "Not set"}
                </dd>
              </div>
            </dl>
            {client.services.length > 0 && (
              <ul className="mt-3 flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 border-t border-zinc-100 dark:border-zinc-800 pt-2 text-sm">
                {client.services.map((s) => (
                  <li key={s} className="flex justify-between py-1.5">
                    <span>{SERVICE_TYPE_LABELS[s]}</span>
                    <span className="text-zinc-500">
                      {serviceRates[s] ? `${serviceRates[s]}% markup` : "Flat quote"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
              Follow-ups
            </h2>
            <FollowUpForm clientId={client.id} />
            {client.followUps.length === 0 ? (
              <EmptyState message="No follow-ups scheduled." />
            ) : (
              <ul className="mt-4 flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
                {client.followUps.map((f) => {
                  const boundToggle = toggleFollowUpAction.bind(
                    null,
                    f.id,
                    client.id,
                  );
                  return (
                    <li key={f.id} className="flex items-center justify-between gap-3 py-2">
                      <div className={f.done ? "opacity-50" : ""}>
                        <p
                          className={`text-sm text-zinc-900 dark:text-zinc-50 ${f.done ? "line-through" : ""}`}
                        >
                          {f.note}
                        </p>
                        <p className="text-xs text-zinc-500">
                          Due {formatDate(f.dueDate)}
                        </p>
                      </div>
                      <form action={boundToggle}>
                        <input type="hidden" name="done" value={String(f.done)} />
                        <button
                          type="submit"
                          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          {f.done ? "Reopen" : "Mark done"}
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
              Activity &amp; notes
            </h2>
            <NoteForm clientId={client.id} />
            {client.clientNotes.length === 0 ? (
              <EmptyState message="No notes yet." />
            ) : (
              <ul className="mt-4 flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
                {client.clientNotes.map((note) => (
                  <li key={note.id} className="py-2">
                    <p className="text-sm text-zinc-900 dark:text-zinc-50">
                      {note.body}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {note.author?.name ?? "Unknown"} · {formatDate(note.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">Service requests</h2>
            {client.serviceRequests.length === 0 ? (
              <EmptyState message="No service requests yet." />
            ) : (
              <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
                {client.serviceRequests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                    <div>
                      <Link href={`/service-requests/${r.id}`} className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">{r.requestNumber}</Link>
                      <p className="text-xs text-zinc-500">{r.lines.map((l) => l.service.name).join(", ")}</p>
                    </div>
                    <Badge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">Documents</h2>
            {documents.length === 0 ? (
              <EmptyState message="No documents received yet." />
            ) : (
              <ul className="flex flex-col divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
                {documents.slice(0, 30).map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {d.fileUrl ? (
                        <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">{d.name}</a>
                      ) : (
                        d.name
                      )}
                      {d.expiryDate && <span className="ml-2 text-xs text-zinc-500">expires {formatDate(d.expiryDate)}</span>}
                    </span>
                    <Link href={`/jobs/${d.jobId}`} className="text-xs text-zinc-500 hover:underline">{d.jobNumber}</Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
              Shipments
            </h2>
            {client.shipments.length === 0 ? (
              <EmptyState message="No shipments for this client." />
            ) : (
              <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
                {client.shipments.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2">
                    <Link
                      href={`/shipments/${s.id}`}
                      className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {s.reference}
                    </Link>
                    <Badge status={s.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
              Quotes
            </h2>
            {client.quotes.length === 0 ? (
              <EmptyState message="No quotes for this client." />
            ) : (
              <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
                {client.quotes.map((q) => (
                  <li key={q.id} className="flex items-center justify-between py-2">
                    <Link
                      href={`/quotes/${q.id}`}
                      className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {q.quoteNumber}
                    </Link>
                    <Badge status={q.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
              Invoices
            </h2>
            {client.invoices.length === 0 ? (
              <EmptyState message="No invoices for this client." />
            ) : (
              <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
                {client.invoices.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between py-2">
                    <div>
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                      >
                        {inv.invoiceNumber}
                      </Link>
                      <p className="text-xs text-zinc-500">
                        due {formatDate(inv.dueDate)}
                      </p>
                    </div>
                    <Badge status={inv.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
