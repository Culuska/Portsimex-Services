import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge, Card, PageHeader } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { invoiceBalance, invoiceTotals } from "@/lib/invoices";
import { SERVICE_TYPE_LABELS } from "@/lib/services";
import { activeMoneyAccounts, clientCredits, PAYMENT_METHOD_LABELS } from "@/lib/finance";
import ActionForm, { fieldClass } from "@/components/ActionForm";
import {
  applyAdvanceAction,
  cancelInvoiceAction,
  deleteDraftInvoiceAction,
  issueInvoiceAction,
  updateInvoiceAdjustmentsAction,
} from "../actions";
import PaymentForm from "../PaymentForm";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      shipment: true,
      items: { include: { job: { include: { service: true } } } },
      payments: { orderBy: { paidAt: "desc" }, include: { moneyAccount: true, advance: true } },
      overpaymentCredits: true,
    },
  });

  if (!invoice) notFound();

  const t = invoiceTotals(invoice);
  const balance = invoiceBalance(invoice);
  const [moneyAccounts, credits] = await Promise.all([activeMoneyAccounts(), clientCredits(prisma, invoice.clientId)]);
  const open = invoice.status !== "CANCELLED";
  const overdue = open && balance > 0.005 && invoice.status !== "DRAFT" && invoice.dueDate < new Date(new Date().setHours(0, 0, 0, 0));
  const boundDelete = deleteDraftInvoiceAction.bind(null, invoice.id);
  const boundIssue = issueInvoiceAction.bind(null, invoice.id);

  return (
    <div>
      <PageHeader
        title={invoice.invoiceNumber}
        description={`${invoice.client.name}${invoice.shipment ? ` · ${invoice.shipment.reference}` : ""}`}
        action={
          <div className="flex items-center gap-3">
            <Link
              href={`/invoices/${invoice.id}/print`}
              target="_blank"
              className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Preview / Print
            </Link>
            <Badge status={invoice.status} />
            {overdue && <Badge status="OVERDUE" />}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">
                Line items
              </h2>
              <p className="text-xs text-zinc-500">Due {formatDate(invoice.dueDate)}</p>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="text-zinc-500">
                <tr>
                  <th className="py-1 font-medium">Job / service</th>
                  <th className="py-1 font-medium">Description</th>
                  <th className="py-1 font-medium text-right">Qty</th>
                  <th className="py-1 font-medium text-right">Unit price</th>
                  <th className="py-1 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {invoice.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 text-zinc-500">
                      {item.job ? (
                        <>
                          <Link href={`/jobs/${item.job.id}`} className="text-brand-600 hover:underline">{item.job.jobNumber}</Link>
                          <p className="text-xs">{item.job.service.name}</p>
                        </>
                      ) : item.serviceType ? (
                        SERVICE_TYPE_LABELS[item.serviceType]
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2">{item.description}</td>
                    <td className="py-2 text-right">{item.quantity.toString()}</td>
                    <td className="py-2 text-right">
                      {formatCurrency(item.unitPrice.toString())}
                    </td>
                    <td className="py-2 text-right">
                      {formatCurrency(Number(item.quantity) * Number(item.unitPrice))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="mt-4 ml-auto grid w-64 grid-cols-2 gap-y-1 border-t border-zinc-100 dark:border-zinc-800 pt-3 text-sm">
              <dt className="text-zinc-500">Subtotal</dt>
              <dd className="text-right">{formatCurrency(t.subtotal)}</dd>
              {t.discount > 0 && (
                <>
                  <dt className="text-zinc-500">Discount</dt>
                  <dd className="text-right">-{formatCurrency(t.discount)}</dd>
                </>
              )}
              {t.tax > 0 && (
                <>
                  <dt className="text-zinc-500">Tax ({t.taxRate}%)</dt>
                  <dd className="text-right">{formatCurrency(t.tax)}</dd>
                </>
              )}
              <dt className="font-medium">Total</dt>
              <dd className="text-right font-medium">{formatCurrency(t.total)}</dd>
              <dt className="text-zinc-500">Paid</dt>
              <dd className="text-right">{formatCurrency(t.total - balance)}</dd>
              <dt className="font-semibold">Balance</dt>
              <dd className="text-right font-semibold">{formatCurrency(open ? Math.max(balance, 0) : 0)}</dd>
            </dl>
            {t.recharged > 0 && (t.discount > 0 || t.tax > 0) && (
              <p className="mt-2 text-right text-xs text-zinc-500">Costs re-charged at cost ({formatCurrency(t.recharged)}) are not discounted or taxed.</p>
            )}
            {invoice.notes && (
              <p className="mt-4 text-sm text-zinc-500 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                {invoice.notes}
              </p>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">Status</h2>
            {invoice.status === "DRAFT" && (
              <div className="flex flex-col gap-4">
                <ActionForm action={updateInvoiceAdjustmentsAction.bind(null, invoice.id)} submitLabel="Save discount & tax" keepValues className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
                    Discount (amount)
                    <input name="discountAmount" type="number" min="0" step="0.01" defaultValue={Number(invoice.discountAmount) || ""} className={`${fieldClass} w-32`} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
                    Tax rate (%)
                    <input name="taxRate" type="number" min="0" max="100" step="0.01" defaultValue={Number(invoice.taxRate) || ""} className={`${fieldClass} w-24`} />
                  </label>
                </ActionForm>
                <p className="text-sm text-zinc-500">Draft -- not yet sent to the client and not in the accounts. Issuing it records the revenue.</p>
                <div className="flex items-center gap-4">
                  <form action={boundIssue}>
                    <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                      Issue invoice
                    </button>
                  </form>
                  <form action={boundDelete}>
                    <button type="submit" className="text-sm text-red-600 hover:underline">
                      Delete draft invoice
                    </button>
                  </form>
                </div>
              </div>
            )}
            {invoice.status === "CANCELLED" && (
              <p className="text-sm text-zinc-500">
                Cancelled {formatDate(invoice.cancelledAt)}
                {invoice.cancelReason ? ` -- ${invoice.cancelReason}` : ""}. The revenue was reversed in the accounts.
              </p>
            )}
            {invoice.status !== "DRAFT" && invoice.status !== "CANCELLED" && (
              <div className="flex flex-col gap-3 text-sm text-zinc-500">
                <p>
                  Issued {formatDate(invoice.issueDate)} · due {formatDate(invoice.dueDate)}
                  {overdue ? " · overdue" : ""}. Paid / partially paid updates automatically from the payments.
                </p>
                {invoice.payments.length === 0 && (
                  <details>
                    <summary className="cursor-pointer text-red-600 hover:underline">Cancel invoice…</summary>
                    <ActionForm
                      action={cancelInvoiceAction.bind(null, invoice.id)}
                      submitLabel="Cancel invoice"
                      confirmMessage="Cancel this invoice? Its revenue will be reversed in the accounts."
                      className="mt-2 flex flex-col gap-2"
                      buttonClassName="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                    >
                      <input name="reason" required placeholder="Reason (e.g. raised in error)" className={fieldClass} />
                    </ActionForm>
                  </details>
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">
              Record a payment
            </h2>
            {!open ? (
              <p className="text-sm text-zinc-500">This invoice is cancelled.</p>
            ) : balance <= 0.005 && invoice.status !== "DRAFT" ? (
              <p className="text-sm text-zinc-500">
                Fully paid. Money received from {invoice.client.name} for future work is recorded as a{" "}
                <Link href={`/finance/advances?client=${invoice.clientId}`} className="text-brand-600 hover:underline">
                  client advance
                </Link>
                .
              </p>
            ) : (
              <PaymentForm invoiceId={invoice.id} moneyAccounts={moneyAccounts} balance={Math.max(balance, 0)} />
            )}
          </Card>

          {open && balance > 0.005 && credits.length > 0 && (
            <Card>
              <h2 className="mb-1 font-semibold text-zinc-900 dark:text-zinc-50">Use client credit</h2>
              <p className="mb-3 text-sm text-zinc-500">
                {invoice.client.name} has {formatCurrency(credits.reduce((s, c) => s + c.remaining, 0))} of advances / credit available.
              </p>
              <ActionForm action={applyAdvanceAction.bind(null, invoice.id)} submitLabel="Apply credit" className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
                  Advance
                  <select name="advanceId" className={fieldClass}>
                    {credits.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.advanceNumber} -- {formatCurrency(c.remaining)} left
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
                  Amount
                  <input
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    defaultValue={Math.min(balance, credits[0].remaining).toFixed(2)}
                    className={`${fieldClass} w-32`}
                  />
                </label>
              </ActionForm>
            </Card>
          )}

          <Card>
            <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">
              Payment history
            </h2>
            {invoice.payments.length === 0 ? (
              <p className="text-sm text-zinc-500">No payments recorded yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
                {invoice.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="text-zinc-900 dark:text-zinc-50">
                        {formatCurrency(p.amount.toString())}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {PAYMENT_METHOD_LABELS[p.method] ?? p.method} · {formatDate(p.paidAt)}
                        {p.moneyAccount ? ` · into ${p.moneyAccount.name}` : ""}
                        {p.advance ? (
                          <>
                            {" · from "}
                            <Link href={`/finance/advances/${p.advance.id}`} className="text-brand-600 hover:underline">
                              {p.advance.advanceNumber}
                            </Link>
                          </>
                        ) : p.reference ? (
                          ` · ${p.reference}`
                        ) : (
                          ""
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {invoice.overpaymentCredits.map((c) => (
              <p key={c.id} className="mt-2 text-xs text-zinc-500">
                Overpaid by {formatCurrency(Number(c.amount))} -- kept as client credit{" "}
                <Link href={`/finance/advances/${c.id}`} className="text-brand-600 hover:underline">
                  {c.advanceNumber}
                </Link>
                .
              </p>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
