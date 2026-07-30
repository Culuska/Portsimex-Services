import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge, Card, PageHeader } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { invoiceBalance, invoiceTotal } from "@/lib/invoices";
import { updateInvoiceStatusAction, deleteDraftInvoiceAction } from "../actions";
import PaymentForm from "../PaymentForm";

const STATUSES = [
  "DRAFT",
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED",
] as const;

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
      items: true,
      payments: { orderBy: { paidAt: "desc" } },
    },
  });

  if (!invoice) notFound();

  const total = invoiceTotal(invoice.items);
  const balance = invoiceBalance(invoice.items, invoice.payments);
  const boundStatus = updateInvoiceStatusAction.bind(null, invoice.id);
  const boundDelete = deleteDraftInvoiceAction.bind(null, invoice.id);

  return (
    <div>
      <PageHeader
        title={invoice.invoiceNumber}
        description={`${invoice.client.name}${invoice.shipment ? ` · ${invoice.shipment.reference}` : ""}`}
        action={<Badge status={invoice.status} />}
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
                  <th className="py-1 font-medium">Description</th>
                  <th className="py-1 font-medium text-right">Qty</th>
                  <th className="py-1 font-medium text-right">Unit price</th>
                  <th className="py-1 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {invoice.items.map((item) => (
                  <tr key={item.id}>
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
            <div className="mt-4 flex flex-col items-end gap-1 border-t border-zinc-100 dark:border-zinc-800 pt-3 text-sm">
              <p className="text-zinc-500">Total: {formatCurrency(total)}</p>
              <p className="text-zinc-500">
                Paid: {formatCurrency(total - Math.max(balance, 0))}
              </p>
              <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                Balance: {formatCurrency(Math.max(balance, 0))}
              </p>
            </div>
            {invoice.notes && (
              <p className="mt-4 text-sm text-zinc-500 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                {invoice.notes}
              </p>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">
              Status
            </h2>
            <form action={boundStatus} className="flex items-center gap-2">
              <select
                name="status"
                defaultValue={invoice.status}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-md border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Update
              </button>
            </form>
            {invoice.status === "DRAFT" && (
              <form action={boundDelete} className="mt-3">
                <button
                  type="submit"
                  className="text-sm text-red-600 hover:underline"
                >
                  Delete draft invoice
                </button>
              </form>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">
              Record a payment
            </h2>
            <PaymentForm invoiceId={invoice.id} />
          </Card>

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
                        {p.method.replace(/_/g, " ")} · {formatDate(p.paidAt)}
                        {p.reference ? ` · ${p.reference}` : ""}
                      </p>
                    </div>
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
