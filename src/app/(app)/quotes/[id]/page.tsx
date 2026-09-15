import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge, Card, PageHeader } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { invoiceTotal } from "@/lib/invoices";
import { SERVICE_TYPE_LABELS } from "@/lib/services";
import {
  updateQuoteStatusAction,
  convertQuoteToInvoiceAction,
  deleteDraftQuoteAction,
} from "../actions";

const STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"] as const;

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      client: true,
      shipment: true,
      items: true,
      invoice: true,
    },
  });

  if (!quote) notFound();

  const total = invoiceTotal(quote.items);
  const boundStatus = updateQuoteStatusAction.bind(null, quote.id);
  const boundConvert = convertQuoteToInvoiceAction.bind(null, quote.id);
  const boundDelete = deleteDraftQuoteAction.bind(null, quote.id);

  return (
    <div>
      <PageHeader
        title={quote.quoteNumber}
        description={`${quote.client.name}${quote.shipment ? ` · ${quote.shipment.reference}` : ""}`}
        action={
          <div className="flex items-center gap-3">
            <Link
              href={`/quotes/${quote.id}/print`}
              target="_blank"
              className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Preview / Print
            </Link>
            <Badge status={quote.status} />
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
              <p className="text-xs text-zinc-500">
                Valid until {formatDate(quote.expiryDate)}
              </p>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="text-zinc-500">
                <tr>
                  <th className="py-1 font-medium">Service</th>
                  <th className="py-1 font-medium">Description</th>
                  <th className="py-1 font-medium text-right">Qty</th>
                  <th className="py-1 font-medium text-right">Unit price</th>
                  <th className="py-1 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {quote.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 text-zinc-500">
                      {item.serviceType ? SERVICE_TYPE_LABELS[item.serviceType] : "—"}
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
            <div className="mt-4 flex justify-end border-t border-zinc-100 dark:border-zinc-800 pt-3 text-sm">
              <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                Total: {formatCurrency(total)}
              </p>
            </div>
            {quote.notes && (
              <p className="mt-4 text-sm text-zinc-500 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                {quote.notes}
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
                defaultValue={quote.status}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
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
            {quote.status === "DRAFT" && (
              <form action={boundDelete} className="mt-3">
                <button type="submit" className="text-sm text-red-600 hover:underline">
                  Delete draft quote
                </button>
              </form>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">Shipment</h2>
            {quote.shipment ? (
              <div>
                <p className="text-sm text-zinc-500">Operational job started as</p>
                <Link
                  href={`/shipments/${quote.shipment.id}`}
                  className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                >
                  {quote.shipment.reference}
                </Link>
              </div>
            ) : quote.status === "ACCEPTED" ? (
              <>
                <p className="mb-3 text-sm text-zinc-500">
                  The shipment will use {quote.quoteNumber} as its tracking reference.
                </p>
                <Link
                  href={`/shipments/new?quoteId=${quote.id}`}
                  className="inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Start shipment
                </Link>
              </>
            ) : (
              <p className="text-sm text-zinc-500">
                Mark this quote as Accepted to start the operational shipment.
              </p>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">
              Convert to invoice
            </h2>
            {quote.invoice ? (
              <div>
                <p className="text-sm text-zinc-500">Already converted to</p>
                <Link
                  href={`/invoices/${quote.invoice.id}`}
                  className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                >
                  {quote.invoice.invoiceNumber}
                </Link>
              </div>
            ) : quote.status === "ACCEPTED" ? (
              <form action={boundConvert}>
                <button
                  type="submit"
                  className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Create invoice from this quote
                </button>
              </form>
            ) : (
              <p className="text-sm text-zinc-500">
                Mark this quote as Accepted to convert it into an invoice.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
