import { requirePermission } from "@/lib/session";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { invoiceBalance, invoiceGrandTotal } from "@/lib/invoices";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";

const FILTERS = [
  ["all", "All"],
  ["draft", "Drafts to issue"],
  ["unpaid", "Awaiting payment"],
  ["overdue", "Overdue"],
  ["paid", "Paid"],
  ["cancelled", "Cancelled"],
] as const;

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  await requirePermission("invoices.view");
  const { f = "all" } = await searchParams;
  const invoices = await prisma.invoice.findMany({
    orderBy: { issueDate: "desc" },
    include: {
      client: true,
      items: { include: { job: { select: { id: true, jobNumber: true } } } },
      payments: true,
    },
  });
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  const rows = invoices
    .map((inv) => {
      const balance = inv.status === "CANCELLED" ? 0 : Math.max(invoiceBalance(inv), 0);
      const issued = inv.status !== "DRAFT" && inv.status !== "CANCELLED";
      const jobs = [...new Map(inv.items.filter((i) => i.job).map((i) => [i.job!.id, i.job!])).values()];
      return { inv, balance, issued, overdue: issued && balance > 0.005 && inv.dueDate < today, jobs };
    })
    .filter((r) => {
      switch (f) {
        case "draft":
          return r.inv.status === "DRAFT";
        case "unpaid":
          return r.issued && r.balance > 0.005;
        case "overdue":
          return r.overdue;
        case "paid":
          return r.issued && r.balance <= 0.005;
        case "cancelled":
          return r.inv.status === "CANCELLED";
        default:
          return true;
      }
    });
  const totalDue = rows.reduce((s, r) => s + r.balance, 0);

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Billing and payment -- every invoice is linked to the jobs it bills"
        action={<ButtonLink href="/invoices/new">New invoice</ButtonLink>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map(([key, label]) => (
          <Link
            key={key}
            href={`/invoices?f=${key}`}
            className={`rounded-full px-3 py-1 text-sm ${
              f === key ? "bg-brand-600 text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800"
            }`}
          >
            {label}
          </Link>
        ))}
        {totalDue > 0.005 && <span className="ml-auto text-sm text-zinc-500">Balance due: <strong>{formatCurrency(totalDue)}</strong></span>}
      </div>
      {rows.length === 0 ? (
        <EmptyState message={f === "all" ? "No invoices yet. Invoice a completed job from its Billing section." : "No invoices here."} />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Jobs</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Balance</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {rows.map(({ inv, balance, overdue, jobs }) => (
                <tr key={inv.id}>
                  <td className="px-4 py-3">
                    <Link href={`/invoices/${inv.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
                      {inv.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{inv.client.name}</td>
                  <td className="px-4 py-3 text-xs">
                    {jobs.length === 0 ? (
                      <span className="text-zinc-400">—</span>
                    ) : (
                      jobs.map((j, i) => (
                        <span key={j.id}>
                          {i > 0 && ", "}
                          <Link href={`/jobs/${j.id}`} className="text-brand-600 hover:underline">
                            {j.jobNumber}
                          </Link>
                        </span>
                      ))
                    )}
                  </td>
                  <td className={`px-4 py-3 ${overdue ? "font-medium text-red-600" : "text-zinc-500"}`}>{formatDate(inv.dueDate)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-500">{formatCurrency(invoiceGrandTotal(inv))}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCurrency(balance)}</td>
                  <td className="px-4 py-3">
                    <Badge status={inv.status} />
                    {overdue && <span className="ml-1"><Badge status="OVERDUE" /></span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
