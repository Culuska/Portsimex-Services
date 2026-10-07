import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge, Card, PageHeader, StatCard } from "@/components/ui";
import ActionForm, { fieldClass } from "@/components/ActionForm";
import { formatCurrency, formatDate } from "@/lib/format";
import { activeMoneyAccounts, billFigures, PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/lib/finance";
import { financeViewer } from "@/lib/finance-access";
import { cancelBillAction, paySupplierBillAction } from "../../actions";

const BILLING_LABELS: Record<string, string> = { NON_BILLABLE: "Company cost", BILLABLE: "Billable at cost", BILLABLE_WITH_MARKUP: "Billable + fee" };

export default async function SupplierBillPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await financeViewer("finance.view", "bills.manage", "bills.pay");
  const { id } = await params;
  const bill = await prisma.supplierBill.findUnique({
    where: { id },
    include: {
      vendor: true,
      lines: { include: { category: true, job: true }, orderBy: { createdAt: "asc" } },
      payments: { include: { moneyAccount: true }, orderBy: { paidAt: "asc" } },
    },
  });
  if (!bill) notFound();
  const [f, moneyAccounts] = await Promise.all([billFigures(prisma, id), activeMoneyAccounts()]);
  const cancelled = bill.status === "CANCELLED";

  return (
    <div>
      <PageHeader
        title={bill.billNumber}
        description={`${bill.vendor.name}${bill.supplierReference ? ` · their invoice ${bill.supplierReference}` : ""} · billed ${formatDate(bill.billDate)} · due ${formatDate(bill.dueDate)}`}
        action={<Badge status={bill.status} />}
      />
      <p className="mb-4 text-sm">
        <Link href="/finance/bills" className="text-brand-600 hover:underline">
          ← Supplier bills
        </Link>
        {bill.attachmentUrl && (
          <>
            {" · "}
            <a href={bill.attachmentUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
              View bill copy{bill.attachmentName ? ` (${bill.attachmentName})` : ""}
            </a>
          </>
        )}
      </p>
      <div className="mb-6 grid grid-cols-3 gap-4">
        <StatCard label="Bill total" value={formatCurrency(f.total)} />
        <StatCard label="Paid" value={formatCurrency(f.paid)} />
        <StatCard label="Balance" value={formatCurrency(cancelled ? 0 : f.balance)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="overflow-x-auto p-0 lg:col-span-2">
          <h2 className="border-b border-zinc-200 px-4 py-3 font-semibold dark:border-zinc-800">Lines</h2>
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-2 font-medium">Cost</th>
                <th className="px-4 py-2 font-medium">Job</th>
                <th className="px-4 py-2 font-medium">Billing</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {bill.lines.map((l) => (
                <tr key={l.id} className={l.status === "REJECTED" ? "text-zinc-400 line-through" : ""}>
                  <td className="px-4 py-2">
                    <Link href={`/expenses/${l.id}`} className="text-brand-600 hover:underline">
                      {l.description}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {l.expenseNumber} · {l.category.name}
                    </p>
                  </td>
                  <td className="px-4 py-2">
                    {l.job ? (
                      <Link href={`/jobs/${l.job.id}`} className="text-brand-600 hover:underline">
                        {l.job.jobNumber}
                      </Link>
                    ) : (
                      <span className="text-zinc-500">Overhead</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-zinc-500">
                    {BILLING_LABELS[l.billingType]}
                    {Number(l.markupAmount) > 0 ? ` (+${formatCurrency(Number(l.markupAmount))})` : ""}
                  </td>
                  <td className="px-4 py-2">
                    <Badge status={l.status} />
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(Number(l.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {f.awaitingApproval > 0 && !cancelled && (
            <p className="border-t border-zinc-200 px-4 py-3 text-sm text-amber-700 dark:border-zinc-800 dark:text-amber-400">
              {f.awaitingApproval} line(s) above the approval threshold need manager approval (open the line to approve) before this bill can be paid.
            </p>
          )}
          {bill.notes && <p className="whitespace-pre-line border-t border-zinc-200 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800">{bill.notes}</p>}
        </Card>

        <div className="flex flex-col gap-6">
          {!cancelled && f.balance > 0.005 && (
            <Card>
              <h2 className="mb-3 font-semibold">Pay supplier</h2>
              <ActionForm action={paySupplierBillAction.bind(null, bill.id)} submitLabel="Record payment" className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <input name="amount" type="number" min="0.01" step="0.01" required defaultValue={f.balance.toFixed(2)} className={fieldClass} aria-label="Amount" />
                  <input name="paidAt" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={fieldClass} aria-label="Date" />
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
                </div>
                <input name="reference" placeholder="Reference (transfer no., cheque...)" className={fieldClass} />
              </ActionForm>
            </Card>
          )}

          <Card>
            <h2 className="mb-3 font-semibold">Payments</h2>
            {bill.payments.length === 0 ? (
              <p className="text-sm text-zinc-500">Nothing paid yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
                {bill.payments.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2 py-2">
                    <span>
                      {formatDate(p.paidAt)} · {PAYMENT_METHOD_LABELS[p.method]}
                      {p.moneyAccount ? ` · from ${p.moneyAccount.name}` : ""}
                      {p.reference ? ` · ${p.reference}` : ""}
                    </span>
                    <span className="tabular-nums">{formatCurrency(Number(p.amount))}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {viewer.can("bills.manage") && !cancelled && f.paid === 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-red-600 hover:underline">Cancel bill (entered in error)…</summary>
              <ActionForm
                action={cancelBillAction.bind(null, bill.id)}
                submitLabel="Cancel bill"
                confirmMessage="Cancel this bill? Its costs will be removed from the accounts."
                className="mt-2 flex flex-col gap-2"
                buttonClassName="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                <input name="reason" required placeholder="Reason" className={fieldClass} />
              </ActionForm>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
