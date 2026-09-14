import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Badge, Card, PageHeader } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { SERVICE_TYPE_LABELS } from "@/lib/services";
import { approvePurchaseRequestAction, rejectPurchaseRequestAction } from "../actions";

export default async function PurchaseRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [pr, session] = await Promise.all([
    prisma.purchaseRequest.findUnique({
      where: { id },
      include: {
        category: true,
        vendor: true,
        shipment: true,
        client: true,
        requestedBy: true,
        decidedBy: true,
        expense: true,
        quoteItem: { include: { quote: true } },
      },
    }),
    auth(),
  ]);

  if (!pr) notFound();

  const isAdmin = session?.user.role === "ADMIN";
  const boundApprove = approvePurchaseRequestAction.bind(null, pr.id);
  const boundReject = rejectPurchaseRequestAction.bind(null, pr.id);

  const markupPercent = pr.client ? Number(pr.client.markupPercent) : null;
  const billableAmount =
    markupPercent !== null ? Number(pr.amount) * (1 + markupPercent / 100) : null;

  return (
    <div>
      <PageHeader
        title={pr.requestNumber}
        description={pr.description}
        action={<Badge status={pr.status} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
            Request details
          </h2>
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Market cost</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-50">
                {formatCurrency(pr.amount.toString())}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Service</dt>
              <dd>{pr.serviceType ? SERVICE_TYPE_LABELS[pr.serviceType] : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Category</dt>
              <dd>{pr.category.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Client</dt>
              <dd>
                {pr.client ? (
                  <Link href={`/clients/${pr.client.id}`} className="hover:underline">
                    {pr.client.name}
                  </Link>
                ) : (
                  "— (internal cost)"
                )}
              </dd>
            </div>
            {billableAmount !== null && (
              <div className="flex justify-between">
                <dt className="text-zinc-500">Client billable ({markupPercent}% markup)</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-50">
                  {formatCurrency(billableAmount.toString())}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-zinc-500">Vendor</dt>
              <dd>{pr.vendor?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Shipment</dt>
              <dd>
                {pr.shipment ? (
                  <Link href={`/shipments/${pr.shipment.id}`} className="hover:underline">
                    {pr.shipment.reference}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Requested by</dt>
              <dd>
                {pr.requestedBy.name} · {formatDate(pr.requestedAt)}
              </dd>
            </div>
            {pr.decidedBy && (
              <div className="flex justify-between">
                <dt className="text-zinc-500">Decided by</dt>
                <dd>
                  {pr.decidedBy.name} · {formatDate(pr.decidedAt)}
                </dd>
              </div>
            )}
          </dl>
          {pr.notes && (
            <p className="mt-4 border-t border-zinc-100 dark:border-zinc-800 pt-3 text-sm text-zinc-500">
              {pr.notes}
            </p>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          {pr.status === "PENDING" && isAdmin && (
            <Card>
              <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">
                Decision
              </h2>
              <div className="flex gap-3">
                <form action={boundApprove}>
                  <button
                    type="submit"
                    className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Approve
                  </button>
                </form>
                <form action={boundReject}>
                  <button
                    type="submit"
                    className="rounded-md border border-red-300 dark:border-red-800 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    Reject
                  </button>
                </form>
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                Approving creates a pending expense for this amount.
              </p>
            </Card>
          )}

          {pr.status === "PENDING" && !isAdmin && (
            <Card>
              <p className="text-sm text-zinc-500">
                Waiting on an admin to approve or reject this request.
              </p>
            </Card>
          )}

          {pr.quoteItem && (
            <Card>
              <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">
                Added to quote
              </h2>
              <Link
                href={`/quotes/${pr.quoteItem.quoteId}`}
                className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
              >
                {pr.quoteItem.quote.quoteNumber}
              </Link>
              <p className="mt-1 text-xs text-zinc-500">
                Billed at {formatCurrency(pr.quoteItem.unitPrice.toString())}
              </p>
            </Card>
          )}

          {pr.expense && (
            <Card>
              <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">
                Linked expense
              </h2>
              <Link
                href={`/expenses/${pr.expense.id}`}
                className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
              >
                {pr.expense.description}
              </Link>
              <p className="mt-1 text-xs text-zinc-500">
                {formatCurrency(pr.expense.amount.toString())} ·{" "}
                <Badge status={pr.expense.status} />
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
