import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import ActionForm, { fieldClass } from "@/components/ActionForm";
import { formatCurrency, formatDate } from "@/lib/format";
import { activeMoneyAccounts } from "@/lib/finance";
import { financeViewer } from "@/lib/finance-access";
import { ensureSystemAccount } from "@/lib/ledger";
import JournalForm from "./JournalForm";
import { createAccountAction, postJournalAction } from "../actions";

export default async function JournalPage() {
  await financeViewer("finance.journal");

  // Make sure the accounts people need for opening balances exist.
  await activeMoneyAccounts();
  await prisma.$transaction(async (tx) => {
    await ensureSystemAccount(tx, "OWNER_EQUITY");
  });
  const [accounts, entries] = await Promise.all([
    prisma.account.findMany({ orderBy: { code: "asc" } }),
    prisma.ledgerTransaction.findMany({
      where: { sourceType: "MANUAL" },
      include: { lines: { include: { account: true } }, createdBy: true },
      orderBy: { transactionDate: "desc" },
      take: 50,
    }),
  ]);
  const options = accounts
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
    .map((a) => ({ id: a.id, label: `${a.code} ${a.name} (${a.type.toLowerCase()})` }));

  return (
    <div>
      <PageHeader
        title="Journal entries"
        description="For anything that isn't an invoice, payment, expense or bill: opening balances, owner capital, loans, depreciation, corrections."
      />
      <p className="mb-4 text-sm">
        <Link href="/finance" className="text-brand-600 hover:underline">
          ← Finance
        </Link>
        {" · "}
        <Link href="/accounting" className="text-brand-600 hover:underline">
          Chart of accounts
        </Link>
      </p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-1 font-semibold">New journal entry</h2>
          <p className="mb-3 text-xs text-zinc-500">
            Example -- opening bank balance of 10,000: debit your bank account 10,000, credit 3000 Owner&apos;s Equity 10,000. Entries can&apos;t be edited
            afterwards; correct a mistake with a reversing entry.
          </p>
          <JournalForm action={postJournalAction} accounts={options} />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Add an account</h2>
          <ActionForm action={createAccountAction} submitLabel="Add account" className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-3">
              <input name="code" required placeholder="Code" className={fieldClass} />
              <input name="name" required placeholder="Name (e.g. Vehicles)" className={`${fieldClass} col-span-2`} />
            </div>
            <select name="type" defaultValue="ASSET" className={fieldClass}>
              <option value="ASSET">Asset (owned, e.g. vehicles, deposits)</option>
              <option value="LIABILITY">Liability (owed, e.g. loans)</option>
              <option value="EQUITY">Equity (owner capital, drawings)</option>
              <option value="REVENUE">Revenue (other income)</option>
              <option value="EXPENSE">Expense (e.g. depreciation)</option>
            </select>
          </ActionForm>
          <p className="mt-3 text-xs text-zinc-500">Cash and bank accounts are added on the Finance page so they can receive payments.</p>
        </Card>
      </div>

      <Card className="mt-6 p-0">
        <h2 className="border-b border-zinc-200 px-4 py-3 font-semibold dark:border-zinc-800">Recent journal entries</h2>
        {entries.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-500">No journal entries yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {entries.map((t) => (
              <li key={t.id} className="px-4 py-3 text-sm">
                <p className="font-medium">
                  {formatDate(t.transactionDate)} · {t.memo}
                  <span className="font-normal text-zinc-500"> · {t.createdBy?.name ?? "system"}</span>
                </p>
                <table className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                  <tbody>
                    {t.lines.map((l) => (
                      <tr key={l.id}>
                        <td className="pr-6">
                          {l.direction === "CREDIT" ? <span className="pl-6" /> : null}
                          {l.account.code} {l.account.name}
                        </td>
                        <td className="w-28 pr-4 text-right tabular-nums">{l.direction === "DEBIT" ? formatCurrency(Number(l.amount)) : ""}</td>
                        <td className="w-28 text-right tabular-nums">{l.direction === "CREDIT" ? formatCurrency(Number(l.amount)) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
