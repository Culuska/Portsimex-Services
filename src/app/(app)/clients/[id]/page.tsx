import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { invoiceBalance, invoiceTotal } from "@/lib/invoices";
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
      invoices: {
        orderBy: { issueDate: "desc" },
        include: { items: true, payments: true },
      },
      quotes: { orderBy: { issueDate: "desc" } },
      clientNotes: { orderBy: { createdAt: "desc" }, include: { author: true } },
      followUps: { orderBy: { dueDate: "asc" } },
      serviceRates: true,
    },
  });

  if (!client) notFound();

  const boundUpdate = updateClientAction.bind(null, client.id);
  const serviceRates = Object.fromEntries(
    client.serviceRates.map((r) => [r.serviceType, r.markupPercent.toString()]),
  );

  const activeShipments = client.shipments.filter(
    (s) => s.status !== "COMPLETED" && s.status !== "CANCELLED",
  ).length;

  const billableInvoices = client.invoices.filter(
    (inv) => inv.status !== "DRAFT" && inv.status !== "CANCELLED",
  );
  const totalInvoiced = billableInvoices.reduce(
    (sum, inv) => sum + invoiceTotal(inv.items),
    0,
  );
  const outstandingBalance = billableInvoices.reduce(
    (sum, inv) => sum + Math.max(invoiceBalance(inv.items, inv.payments), 0),
    0,
  );

  const decidedQuotes = client.quotes.filter(
    (q) => q.status === "ACCEPTED" || q.status === "REJECTED",
  );
  const acceptedQuotes = client.quotes.filter((q) => q.status === "ACCEPTED").length;

  return (
    <div>
      <PageHeader
        title={client.name}
        description="Client details"
        action={<Badge status={client.stage} />}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active shipments"
          value={String(activeShipments)}
          hint={`${client.shipments.length} total`}
        />
        <StatCard label="Total invoiced" value={formatCurrency(totalInvoiced)} />
        <StatCard
          label="Outstanding balance"
          value={formatCurrency(outstandingBalance)}
        />
        <StatCard
          label="Quotes accepted"
          value={`${acceptedQuotes}/${client.quotes.length}`}
          hint={
            decidedQuotes.length > 0
              ? `${Math.round((acceptedQuotes / decidedQuotes.length) * 100)}% win rate`
              : undefined
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
              Edit details
            </h2>
            <ClientForm
              action={boundUpdate}
              defaultValues={{ ...client, serviceRates }}
              submitLabel="Save changes"
            />
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
