import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import ActionForm, { fieldClass } from "@/components/ActionForm";
import { formatCurrency, formatDate } from "@/lib/format";
import { activeMoneyAccounts, balanceOfAdvance, PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/lib/finance";
import { financeViewer } from "@/lib/finance-access";
import { receiveAdvanceAction } from "../actions";

export default async function AdvancesPage({ searchParams }: { searchParams: Promise<{ client?: string; show?: string }> }) {
  const viewer = await financeViewer();
  if (!viewer.isStaff) redirect("/");
  const { client: clientFilter, show } = await searchParams;

  const [advances, clients, jobs, moneyAccounts] = await Promise.all([
    prisma.clientAdvance.findMany({
      where: clientFilter ? { clientId: clientFilter } : {},
      include: { client: true, job: true, applications: { select: { amount: true } }, refunds: { select: { amount: true } } },
      orderBy: { receivedAt: "desc" },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.job.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING", "COMPLETED"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, jobNumber: true, client: { select: { name: true } } },
      take: 300,
    }),
    activeMoneyAccounts(),
  ]);
  const rows = advances.map((a) => ({ a, b: balanceOfAdvance(a) }));
  const visible = show === "all" ? rows : rows.filter((r) => r.b.remaining > 0.005);
  const totals = rows.reduce(
    (s, r) => ({ received: s.received + r.b.amount, applied: s.applied + r.b.applied, refunded: s.refunded + r.b.refunded, remaining: s.remaining + r.b.remaining }),
    { received: 0, applied: 0, refunded: 0, remaining: 0 },
  );

  return (
    <div>
      <PageHeader
        title="Client advances & credits"
        description="Deposits paid before invoicing and overpayments. Held as a liability until used on an invoice or refunded -- never counted as revenue."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <Link href={`/finance/advances${clientFilter ? `?client=${clientFilter}` : ""}`} className={show === "all" ? "text-brand-600 hover:underline" : "font-semibold"}>
              With credit left
            </Link>
            <Link href={`/finance/advances?show=all${clientFilter ? `&client=${clientFilter}` : ""}`} className={show === "all" ? "font-semibold" : "text-brand-600 hover:underline"}>
              All
            </Link>
            <span className="text-zinc-500">
              Received {formatCurrency(totals.received)} · used {formatCurrency(totals.applied)} · refunded {formatCurrency(totals.refunded)} ·{" "}
              <strong>remaining {formatCurrency(totals.remaining)}</strong>
            </span>
          </div>
          {visible.length === 0 ? (
            <EmptyState message="No client advances with credit left." />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <tr>
                    <th className="px-4 py-2 font-medium">Advance</th>
                    <th className="px-4 py-2 font-medium">Client</th>
                    <th className="px-4 py-2 font-medium">Received</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                    <th className="px-4 py-2 text-right font-medium">Used</th>
                    <th className="px-4 py-2 text-right font-medium">Refunded</th>
                    <th className="px-4 py-2 text-right font-medium">Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {visible.map(({ a, b }) => (
                    <tr key={a.id}>
                      <td className="px-4 py-2">
                        <Link href={`/finance/advances/${a.id}`} className="font-medium text-brand-600 hover:underline">
                          {a.advanceNumber}
                        </Link>
                        <p className="text-xs text-zinc-500">
                          {a.source === "OVERPAYMENT" ? "Overpayment credit" : PAYMENT_METHOD_LABELS[a.method]}
                          {a.job ? ` · ${a.job.jobNumber}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-2">{a.client.name}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-zinc-500">{formatDate(a.receivedAt)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(b.amount)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{b.applied ? formatCurrency(b.applied) : ""}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{b.refunded ? formatCurrency(b.refunded) : ""}</td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums">
                        {b.remaining > 0.005 ? formatCurrency(b.remaining) : <Badge status="USED" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        <Card>
          <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">Receive an advance / deposit</h2>
          <ActionForm action={receiveAdvanceAction} submitLabel="Record advance" pendingLabel="Recording...">
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
              Client
              <select name="clientId" required defaultValue={clientFilter ?? ""} className={fieldClass}>
                <option value="">Choose…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
                Amount
                <input name="amount" type="number" min="0.01" step="0.01" required className={fieldClass} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
                Date
                <input name="receivedAt" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={fieldClass} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
                Method
                <select name="method" defaultValue="BANK_TRANSFER" className={fieldClass}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABELS[m]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
                Received into
                <select name="moneyAccountId" className={fieldClass}>
                  {moneyAccounts.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
              For job (optional)
              <select name="jobId" className={fieldClass}>
                <option value="">General deposit</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.jobNumber} -- {j.client.name}
                  </option>
                ))}
              </select>
            </label>
            <input name="reference" placeholder="Reference (bank ref, receipt no.)" className={fieldClass} />
            <input name="notes" placeholder="Notes" className={fieldClass} />
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
