import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { invoiceBalance, invoiceTotal } from "@/lib/invoices";
import ShipmentForm from "../ShipmentForm";
import { updateShipmentAction } from "../actions";

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [shipment, clients, users] = await Promise.all([
    prisma.shipment.findUnique({
      where: { id },
      include: {
        client: true,
        assignee: true,
        invoices: { include: { items: true, payments: true } },
        expenses: { include: { category: true, vendor: true } },
        quotes: { include: { items: true } },
        purchaseRequests: { include: { category: true } },
      },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!shipment) notFound();

  const revenue = shipment.invoices
    .filter((inv) => inv.status !== "DRAFT" && inv.status !== "CANCELLED")
    .reduce((sum, inv) => sum + invoiceTotal(inv.items), 0);
  const costs = shipment.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const margin = revenue - costs;

  const boundUpdate = updateShipmentAction.bind(null, shipment.id);

  return (
    <div>
      <PageHeader
        title={shipment.reference}
        description={`${shipment.client.name} · ${shipment.origin} → ${shipment.destination}`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <StatCard label="Job revenue" value={formatCurrency(revenue)} />
        <StatCard label="Job costs" value={formatCurrency(costs)} />
        <StatCard label="Job margin" value={formatCurrency(margin)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
            Edit shipment
          </h2>
          <ShipmentForm
            action={boundUpdate}
            clients={clients}
            users={users}
            defaultValues={shipment}
            submitLabel="Save changes"
            showStatus
          />
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Quotes</h2>
              <Link
                href={`/quotes/new?shipmentId=${shipment.id}`}
                className="text-sm text-brand-600 hover:underline"
              >
                New quote
              </Link>
            </div>
            {shipment.quotes.length === 0 ? (
              <EmptyState message="No quotes linked to this shipment." />
            ) : (
              <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
                {shipment.quotes.map((q) => (
                  <li key={q.id} className="flex items-center justify-between py-2">
                    <div>
                      <Link
                        href={`/quotes/${q.id}`}
                        className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                      >
                        {q.quoteNumber}
                      </Link>
                      <p className="text-xs text-zinc-500">
                        {formatCurrency(invoiceTotal(q.items))}
                      </p>
                    </div>
                    <Badge status={q.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Invoices</h2>
              <Link
                href={`/invoices/new?shipmentId=${shipment.id}`}
                className="text-sm text-brand-600 hover:underline"
              >
                New invoice
              </Link>
            </div>
            {shipment.invoices.length === 0 ? (
              <EmptyState message="No invoices linked to this shipment." />
            ) : (
              <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
                {shipment.invoices.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between py-2">
                    <div>
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                      >
                        {inv.invoiceNumber}
                      </Link>
                      <p className="text-xs text-zinc-500">
                        Balance {formatCurrency(invoiceBalance(inv.items, inv.payments))}
                      </p>
                    </div>
                    <Badge status={inv.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Expenses</h2>
              <Link
                href={`/expenses/new?shipmentId=${shipment.id}`}
                className="text-sm text-brand-600 hover:underline"
              >
                New expense
              </Link>
            </div>
            {shipment.expenses.length === 0 ? (
              <EmptyState message="No expenses linked to this shipment." />
            ) : (
              <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
                {shipment.expenses.map((e) => (
                  <li key={e.id} className="flex items-center justify-between py-2">
                    <div>
                      <Link
                        href={`/expenses/${e.id}`}
                        className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                      >
                        {e.description}
                      </Link>
                      <p className="text-xs text-zinc-500">
                        {e.category.name} · {formatDate(e.incurredAt)}
                      </p>
                    </div>
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      {formatCurrency(e.amount.toString())}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">
                Purchase Requests
              </h2>
              <Link
                href={`/purchase-requests/new?shipmentId=${shipment.id}`}
                className="text-sm text-brand-600 hover:underline"
              >
                New request
              </Link>
            </div>
            {shipment.purchaseRequests.length === 0 ? (
              <EmptyState message="No purchase requests linked to this shipment." />
            ) : (
              <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
                {shipment.purchaseRequests.map((pr) => (
                  <li key={pr.id} className="flex items-center justify-between py-2">
                    <div>
                      <Link
                        href={`/purchase-requests/${pr.id}`}
                        className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                      >
                        {pr.requestNumber}
                      </Link>
                      <p className="text-xs text-zinc-500">{pr.category.name}</p>
                    </div>
                    <Badge status={pr.status} />
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
