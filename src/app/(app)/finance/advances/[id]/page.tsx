import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader, StatCard } from "@/components/ui";
import ActionForm, { fieldClass } from "@/components/ActionForm";
import { formatCurrency, formatDate } from "@/lib/format";
import { activeMoneyAccounts, balanceOfAdvance, PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/lib/finance";
import { financeViewer } from "@/lib/finance-access";
import { invoiceBalance } from "@/lib/invoices";
import { applyAdvanceToInvoiceAction, refundAdvanceAction } from "../../actions";

export default async function AdvancePage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await financeViewer("finance.view", "payments.record");
  const { id } = await params;
  const advance = await prisma.clientAdvance.findUnique({
    where: { id },
    include: {
      client: true,
      job: true,
      moneyAccount: true,
      sourceInvoice: true,
      applications: { include: { invoice: true }, orderBy: { paidAt: "asc" } },
      refunds: { include: { moneyAccount: true }, orderBy: { refundedAt: "asc" } },
    },
  });
  if (!advance) notFound();
  const b = balanceOfAdvance(advance);

  const [openInvoices, moneyAccounts] = await Promise.all([
    prisma.invoice.findMany({
      where: { clientId: advance.clientId, status: { in: ["DRAFT", "SENT", "PARTIALLY_PAID", "OVERDUE"] } },
      include: { items: true, payments: true },
      orderBy: { dueDate: "asc" },
    }),
    activeMoneyAccounts(),
  ]);
  const payable = openInvoices.map((i) => ({ i, balance: invoiceBalance(i) })).filter((x) => x.balance > 0.005);

  return (
    <div>
      <PageHeader
        title={advance.advanceNumber}
        description={`${advance.source === "OVERPAYMENT" ? "Overpayment credit" : "Advance / deposit"} from ${advance.client.name} · received ${formatDate(advance.receivedAt)}`}
      />
      <p className="mb-4 text-sm">
        <Link href="/finance/advances" className="text-brand-600 hover:underline">
          ← Client advances
        </Link>
      </p>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Received" value={formatCurrency(b.amount)} />
        <StatCard label="Used on invoices" value={formatCurrency(b.applied)} />
        <StatCard label="Refunded" value={formatCurrency(b.refunded)} />
        <StatCard label="Remaining" value={formatCurrency(b.remaining)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">Details</h2>
            <dl className="grid grid-cols-[10rem_1fr] gap-y-1 text-sm">
              <dt className="text-zinc-500">Client</dt>
              <dd>
                <Link href={`/clients/${advance.clientId}`} className="text-brand-600 hover:underline">
                  {advance.client.name}
                </Link>
              </dd>
              <dt className="text-zinc-500">Method</dt>
              <dd>{PAYMENT_METHOD_LABELS[advance.method]}</dd>
              <dt className="text-zinc-500">Received into</dt>
              <dd>{advance.moneyAccount?.name ?? "Cash on hand"}</dd>
              {advance.reference && (
                <>
                  <dt className="text-zinc-500">Reference</dt>
                  <dd>{advance.reference}</dd>
                </>
              )}
              {advance.job && (
                <>
                  <dt className="text-zinc-500">For job</dt>
                  <dd>
                    <Link href={`/jobs/${advance.job.id}`} className="text-brand-600 hover:underline">
                      {advance.job.jobNumber}
                    </Link>
                  </dd>
                </>
              )}
              {advance.sourceInvoice && (
                <>
                  <dt className="text-zinc-500">Overpaid invoice</dt>
                  <dd>
                    <Link href={`/invoices/${advance.sourceInvoice.id}`} className="text-brand-600 hover:underline">
                      {advance.sourceInvoice.invoiceNumber}
                    </Link>
                  </dd>
                </>
              )}
              {advance.notes && (
                <>
                  <dt className="text-zinc-500">Notes</dt>
                  <dd>{advance.notes}</dd>
                </>
              )}
            </dl>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">History</h2>
            <ul className="flex flex-col divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
              <li className="flex justify-between py-2">
                <span>Received · {formatDate(advance.receivedAt)}</span>
                <span className="tabular-nums">+{formatCurrency(b.amount)}</span>
              </li>
              {advance.applications.map((p) => (
                <li key={p.id} className="flex justify-between py-2">
                  <span>
                    Used on{" "}
                    <Link href={`/invoices/${p.invoice.id}`} className="text-brand-600 hover:underline">
                      {p.invoice.invoiceNumber}
                    </Link>{" "}
                    · {formatDate(p.paidAt)}
                  </span>
                  <span className="tabular-nums">-{formatCurrency(Number(p.amount))}</span>
                </li>
              ))}
              {advance.refunds.map((r) => (
                <li key={r.id} className="flex justify-between py-2">
                  <span>
                    Refunded · {formatDate(r.refundedAt)} · {r.reason}
                    {r.moneyAccount ? ` · from ${r.moneyAccount.name}` : ""}
                  </span>
                  <span className="tabular-nums">-{formatCurrency(Number(r.amount))}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          {b.remaining > 0.005 && (
            <Card>
              <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">Use on an invoice</h2>
              {payable.length === 0 ? (
                <p className="text-sm text-zinc-500">{advance.client.name} has no unpaid invoices right now.</p>
              ) : (
                <ActionForm action={applyAdvanceToInvoiceAction.bind(null, advance.id)} submitLabel="Apply to invoice" className="flex flex-col gap-3">
                  <select name="invoiceId" className={fieldClass}>
                    {payable.map(({ i, balance }) => (
                      <option key={i.id} value={i.id}>
                        {i.invoiceNumber} -- {formatCurrency(balance)} due{i.status === "DRAFT" ? " (draft)" : ""}
                      </option>
                    ))}
                  </select>
                  <input
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    defaultValue={Math.min(b.remaining, payable[0].balance).toFixed(2)}
                    className={fieldClass}
                  />
                </ActionForm>
              )}
            </Card>
          )}

          {b.remaining > 0.005 && viewer.can("finance.refunds") && (
            <Card>
              <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">Refund to client</h2>
              <ActionForm
                action={refundAdvanceAction.bind(null, advance.id)}
                submitLabel="Record refund"
                confirmMessage="Record this refund? The money leaves the selected account."
                className="grid grid-cols-2 gap-3"
              >
                <input name="amount" type="number" min="0.01" step="0.01" required defaultValue={b.remaining.toFixed(2)} className={fieldClass} aria-label="Amount" />
                <input name="refundedAt" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={fieldClass} aria-label="Date" />
                <select name="method" defaultValue="BANK_TRANSFER" className={fieldClass} aria-label="Method">
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABELS[m]}
                    </option>
                  ))}
                </select>
                <select name="moneyAccountId" className={fieldClass} aria-label="Paid from">
                  {moneyAccounts.map((m) => (
                    <option key={m.id} value={m.id}>
                      from {m.name}
                    </option>
                  ))}
                </select>
                <input name="reason" required placeholder="Reason (e.g. service cancelled)" className={`${fieldClass} col-span-2`} />
                <input name="reference" placeholder="Reference" className={`${fieldClass} col-span-2`} />
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
