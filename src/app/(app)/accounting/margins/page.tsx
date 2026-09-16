import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isFullAccessRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { formatCurrency } from "@/lib/format";

type MarginRow = {
  id: string;
  reference: string;
  type: string;
  revenue: string | number;
  direct_costs: string | number;
  net_margin: string | number;
};

// Net Job Margin = Invoice Revenue - Direct Expenses, per shipment.
// Revenue only counts invoices that have actually been issued
// (revenueRecognizedAt set) rather than drafts; direct expenses are every
// Expense tied to that shipment (fuel/tolls/carrier payouts and any other
// cost recorded against it -- this is a subcontracted freight-forwarding
// business with no owned fleet, so all such costs already flow through
// Expense/Vendor rather than a separate driver-payroll table).
export default async function NetJobMarginPage() {
  const session = await auth();
  if (!session || !isFullAccessRole(session.user.role)) redirect("/");

  const rows = await prisma.$queryRaw<MarginRow[]>`
    WITH revenue AS (
      SELECT i."shipmentId" AS shipment_id, SUM(ii.quantity * ii."unitPrice") AS revenue
      FROM invoice_items ii
      JOIN invoices i ON i.id = ii."invoiceId"
      WHERE i."shipmentId" IS NOT NULL AND i."revenueRecognizedAt" IS NOT NULL
      GROUP BY i."shipmentId"
    ),
    direct_costs AS (
      SELECT e."shipmentId" AS shipment_id, SUM(e.amount) AS costs
      FROM expenses e
      WHERE e."shipmentId" IS NOT NULL
      GROUP BY e."shipmentId"
    )
    SELECT
      s.id,
      s.reference,
      s.type::text AS type,
      COALESCE(revenue.revenue, 0) AS revenue,
      COALESCE(direct_costs.costs, 0) AS direct_costs,
      COALESCE(revenue.revenue, 0) - COALESCE(direct_costs.costs, 0) AS net_margin
    FROM shipments s
    LEFT JOIN revenue ON revenue.shipment_id = s.id
    LEFT JOIN direct_costs ON direct_costs.shipment_id = s.id
    WHERE revenue.revenue IS NOT NULL OR direct_costs.costs IS NOT NULL
    ORDER BY s."createdAt" DESC
    LIMIT 200
  `;

  return (
    <div>
      <PageHeader
        title="Net Job Margin"
        description="Invoice revenue minus direct expenses, per shipment"
        action={
          <Link
            href="/accounting"
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Chart of Accounts
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState message="No shipments with recognized revenue or direct expenses yet." />
      ) : (
        <Card className="p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Shipment</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium text-right">Revenue</th>
                <th className="px-4 py-3 font-medium text-right">Direct expenses</th>
                <th className="px-4 py-3 font-medium text-right">Net margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {rows.map((r) => {
                const margin = Number(r.net_margin);
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                      {r.reference}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{r.type}</td>
                    <td className="px-4 py-3 text-right text-zinc-500">
                      {formatCurrency(Number(r.revenue))}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-500">
                      {formatCurrency(Number(r.direct_costs))}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        margin < 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-emerald-700 dark:text-emerald-400"
                      }`}
                    >
                      {formatCurrency(margin)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
