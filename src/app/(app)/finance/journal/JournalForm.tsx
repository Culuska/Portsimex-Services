"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { fieldClass } from "@/components/ActionForm";

type Line = { accountId: string; debit: string; credit: string };
const blank = (): Line => ({ accountId: "", debit: "", credit: "" });

export default function JournalForm({
  action,
  accounts,
}: {
  action: (state: { error: string | null }, formData: FormData) => Promise<{ error: string | null }>;
  accounts: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [lines, setLines] = useState<Line[]>([blank(), blank()]);
  const submitted = useRef(false);
  const set = (i: number, k: keyof Line, v: string) => setLines((p) => p.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const debits = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const credits = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(debits - credits) < 0.005 && debits > 0;

  useEffect(() => {
    if (!pending && submitted.current && !state.error) setLines([blank(), blank()]);
    if (!pending) submitted.current = false;
  }, [pending, state]);

  return (
    <form action={formAction} onSubmit={() => (submitted.current = true)} className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        <input name="memo" required placeholder="Description (e.g. Opening balance -- KCB account)" className={`${fieldClass} col-span-2`} />
        <input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={fieldClass} />
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-zinc-500">
          <tr>
            <th className="pb-1 font-medium">Account</th>
            <th className="w-32 pb-1 font-medium">Debit</th>
            <th className="w-32 pb-1 font-medium">Credit</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td className="py-1 pr-2">
                <select name="accountId[]" value={l.accountId} onChange={(e) => set(i, "accountId", e.target.value)} className={`${fieldClass} w-full`}>
                  <option value="">Choose account…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-1 pr-2">
                <input name="debit[]" type="number" min="0" step="0.01" value={l.debit} onChange={(e) => set(i, "debit", e.target.value)} className={`${fieldClass} w-full`} />
              </td>
              <td className="py-1">
                <input name="credit[]" type="number" min="0" step="0.01" value={l.credit} onChange={(e) => set(i, "credit", e.target.value)} className={`${fieldClass} w-full`} />
              </td>
            </tr>
          ))}
          <tr className="text-sm font-medium">
            <td className="pt-2">
              <button type="button" onClick={() => setLines((p) => [...p, blank()])} className="text-brand-600 hover:underline">
                + Add line
              </button>
            </td>
            <td className="pt-2 tabular-nums">{debits.toFixed(2)}</td>
            <td className="pt-2 tabular-nums">{credits.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
      {!balanced && (debits > 0 || credits > 0) && <p className="text-xs text-amber-700">Debits and credits must be equal.</p>}
      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      <button type="submit" disabled={pending || !balanced} className="w-fit rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
        {pending ? "Posting..." : "Post journal entry"}
      </button>
    </form>
  );
}
