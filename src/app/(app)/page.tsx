import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { invoiceBalance } from "@/lib/invoices";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";

// Scoped roles land on their own portal -- this dashboard shows
// company-wide financial data that isn't appropriate for them to see.
const ROLE_HOME: Record<string, string> = {
  VENDOR: "/my-shipments",
  MINISTRY_OFFICER: "/ministry",
  MINISTRY_REGISTRAR: "/ministries",
  LOGISTICS_STAFF: "/deliveries",
};

export default async function DashboardPage() {
  const session = await auth();
  const home = session ? ROLE_HOME[session.user.role] : undefined;
  if (home) {
    redirect(home);
  }

  const [
    shipments,
    invoices,
    expensePaidAgg,
    expensePendingAgg,
    paymentAgg,
    shipmentStatusCounts,
    pendingPurchaseRequests,
  ] = await Promise.all([
    prisma.shipment.findMany({
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: { client: true },
    }),
    prisma.invoice.findMany({
      where: { status: { notIn: ["DRAFT", "CANCELLED"] } },
      include: { items: true, payments: true, client: true },
      orderBy: { issueDate: "desc" },
    }),
    prisma.expense.aggregate({
      where: { status: "PAID" },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { status: "PENDING" },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({ _sum: { amount: true } }),
    prisma.shipment.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.purchaseRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { requestedAt: "asc" },
      include: { requestedBy: true },
    }),
  ]);

  const activeShipments = shipmentStatusCounts
    .filter((s) => s.status !== "COMPLETED" && s.status !== "CANCELLED")
    .reduce((sum, s) => sum + s._count._all, 0);

  const totalRevenue = Number(paymentAgg._sum.amount ?? 0);
  const totalExpenses = Number(expensePaidAgg._sum.amount ?? 0);
  const pendingExpenses = Number(expensePendingAgg._sum.amount ?? 0);
  const profit = totalRevenue - totalExpenses;
  const outstanding = invoices.reduce(
    (sum, inv) => sum + Math.max(invoiceBalance(inv.items, inv.payments), 0),
    0,
  );

  const recentInvoices = invoices.slice(0, 5);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Combined view of operations and finances"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Active shipments" value={String(activeShipments)} />
        <StatCard label="Revenue collected" value={formatCurrency(totalRevenue)} />
        <StatCard
          label="Expenses"
          value={formatCurrency(totalExpenses)}
          hint={pendingExpenses > 0 ? `${formatCurrency(pendingExpenses)} pending` : undefined}
        />
        <StatCard
          label="Net profit"
          value={formatCurrency(profit)}
          hint={outstanding > 0 ? `${formatCurrency(outstanding)} outstanding` : undefined}
        />
        <StatCard
          label="Pending approvals"
          value={String(pendingPurchaseRequests.length)}
          hint={
            pendingPurchaseRequests.length > 0
              ? `${formatCurrency(
                  pendingPurchaseRequests.reduce((sum, pr) => sum + Number(pr.amount), 0),
                )} requested`
              : undefined
          }
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">
              Recent shipments
            </h2>
            <Link href="/shipments" className="text-sm text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          {shipments.length === 0 ? (
            <EmptyState message="No shipments yet." />
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
              {shipments.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-3">
                  <div>
                    <Link
                      href={`/shipments/${s.id}`}
                      className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {s.reference}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {s.client.name} · {s.origin} → {s.destination}
                    </p>
                  </div>
                  <Badge status={s.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">
              Recent invoices
            </h2>
            <Link href="/invoices" className="text-sm text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          {recentInvoices.length === 0 ? (
            <EmptyState message="No invoices yet." />
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
              {recentInvoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between py-3">
                  <div>
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {inv.invoiceNumber}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {inv.client.name} · due {formatDate(inv.dueDate)}
                    </p>
                  </div>
                  <Badge status={inv.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {pendingPurchaseRequests.length > 0 && (
        <div className="mt-6">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">
                Needs approval
              </h2>
              <Link
                href="/purchase-requests"
                className="text-sm text-brand-600 hover:underline"
              >
                View all
              </Link>
            </div>
            <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
              {pendingPurchaseRequests.map((pr) => (
                <li key={pr.id} className="flex items-center justify-between py-3">
                  <div>
                    <Link
                      href={`/purchase-requests/${pr.id}`}
                      className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {pr.requestNumber}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {pr.description} · requested by {pr.requestedBy.name}
                    </p>
                  </div>
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    {formatCurrency(pr.amount.toString())}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
