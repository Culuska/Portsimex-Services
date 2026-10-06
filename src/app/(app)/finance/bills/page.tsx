import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { financeViewer } from "@/lib/finance-access";

const FILTERS = [
  { key: "open", label: "Unpaid", statuses: ["OPEN", "PARTIALLY_PAID"] },
  { key: "paid", label: "Paid", statuses: ["PAID"] },
  { key: "all", label: "All", statuses: ["OPEN", "PARTIALLY_PAID", "PAID", "CANCELLED"] },
] as const;

export default async function SupplierBillsPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const viewer = await financeViewer();
  if (!viewer.isStaff) redirect("/");
  const { f } = await searchParams;
  const filter = FILTERS.find((x) => x.key === f) ?? FILTERS[0];
  const bills = await prisma.supplierBill.findMany({
    where: { status: { in: [...filter.statuses] } },
    include: { vendor: true, lines: { select: { amount: true, status: true } }, payments: { select: { amount: true } } },
    orderBy: { dueDate: "asc" },
  });
  const today = new Date(new Date().setHours(0, 0, 0, 0));

  return (
    <div>
      <PageHeader
        title="Supplier bills"
        description="Invoices from suppliers (transporters, agents, telecom providers...). Each line is a cost on a job; the bill is paid in one or more payments."
        action={<ButtonLink href="/finance/bills/new">Record supplier bill</ButtonLink>}
      />
      <div className="mb-4 flex gap-1">
        {FILTERS.map((x) => (
          <Link
            key={x.key}
            href={`/finance/bills?f=${x.key}`}
            className={`rounded-md px-3 py-1.5 text-sm ${x.key === filter.key ? "bg-brand-600 text-white" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}
          >
            {x.label}
          </Link>
        ))}
      </div>
      {bills.length === 0 ? (
        <EmptyState message="No supplier bills here." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-2 font-medium">Bill</th>
                <th className="px-4 py-2 font-medium">Supplier</th>
                <th className="px-4 py-2 font-medium">Bill date</th>
                <th className="px-4 py-2 font-medium">Due</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 text-right font-medium">Balance</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {bills.map((b) => {
                const total = b.lines.filter((l) => l.status !== "REJECTED").reduce((s, l) => s + Number(l.amount), 0);
                const paid = b.payments.reduce((s, p) => s + Number(p.amount), 0);
                const balance = b.status === "CANCELLED" ? 0 : total - paid;
                const late = balance > 0.005 && b.dueDate < today;
                return (
                  <tr key={b.id}>
                    <td className="px-4 py-2">
                      <Link href={`/finance/bills/${b.id}`} className="font-medium text-brand-600 hover:underline">
                        {b.billNumber}
                      </Link>
                      {b.supplierReference && <p className="text-xs text-zinc-500">Their ref {b.supplierReference}</p>}
                    </td>
                    <td className="px-4 py-2">{b.vendor.name}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-zinc-500">{formatDate(b.billDate)}</td>
                    <td className={`whitespace-nowrap px-4 py-2 ${late ? "font-medium text-red-600" : "text-zinc-500"}`}>{formatDate(b.dueDate)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(total)}</td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums">{formatCurrency(balance)}</td>
                    <td className="px-4 py-2">
                      <Badge status={b.status} />
                      {late && <span className="ml-1"><Badge status="OVERDUE" /></span>}
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
