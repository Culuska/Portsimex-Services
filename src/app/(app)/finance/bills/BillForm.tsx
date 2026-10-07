"use client";

import { useActionState, useState } from "react";
import { fieldClass } from "@/components/ActionForm";

type Line = { description: string; categoryName: string; amount: string; jobId: string; billingType: string; markupAmount: string };
const blank = (): Line => ({ description: "", categoryName: "", amount: "", jobId: "", billingType: "NON_BILLABLE", markupAmount: "" });

export default function BillForm({
  action,
  vendors,
  jobs,
  categories,
  defaultVendorId,
}: {
  action: (state: { error: string | null }, formData: FormData) => Promise<{ error: string | null }>;
  vendors: { id: string; name: string }[];
  jobs: { id: string; label: string }[];
  categories: string[];
  defaultVendorId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [lines, setLines] = useState<Line[]>([blank()]);
  const today = new Date().toISOString().slice(0, 10);
  const [due] = useState(() => new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10));
  const set = (i: number, k: keyof Line, v: string) => setLines((prev) => prev.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 sm:col-span-2">
          Supplier
          <select name="vendorId" required defaultValue={defaultVendorId ?? ""} className={fieldClass}>
            <option value="">Choose…</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 sm:col-span-2">
          Supplier&apos;s invoice number
          <input name="supplierReference" className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
          Bill date
          <input name="billDate" type="date" required defaultValue={today} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
          Due date
          <input name="dueDate" type="date" required defaultValue={due} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 sm:col-span-2">
          Copy of the bill (optional)
          <input name="attachment" type="file" accept="image/*,application/pdf" className="text-sm" />
        </label>
      </div>

      <datalist id="bill-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Lines</p>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800 sm:grid-cols-6">
            <input name="description[]" placeholder="Description" value={l.description} onChange={(e) => set(i, "description", e.target.value)} className={`${fieldClass} col-span-2`} />
            <input name="categoryName[]" list="bill-categories" placeholder="Category" value={l.categoryName} onChange={(e) => set(i, "categoryName", e.target.value)} className={fieldClass} />
            <input name="amount[]" type="number" min="0" step="0.01" placeholder="Amount" value={l.amount} onChange={(e) => set(i, "amount", e.target.value)} className={fieldClass} />
            <select name="jobId[]" value={l.jobId} onChange={(e) => set(i, "jobId", e.target.value)} className={`${fieldClass} col-span-2`}>
              <option value="">No job (overhead)</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.label}
                </option>
              ))}
            </select>
            <select name="billingType[]" value={l.billingType} onChange={(e) => set(i, "billingType", e.target.value)} className={`${fieldClass} col-span-2`}>
              <option value="NON_BILLABLE">Company cost (not re-charged)</option>
              <option value="BILLABLE">Billable to client at cost</option>
              <option value="BILLABLE_WITH_MARKUP">Billable + handling fee</option>
            </select>
            {l.billingType === "BILLABLE_WITH_MARKUP" ? (
              <input name="markupAmount[]" type="number" min="0" step="0.01" placeholder="Handling fee" value={l.markupAmount} onChange={(e) => set(i, "markupAmount", e.target.value)} className={fieldClass} />
            ) : (
              <input type="hidden" name="markupAmount[]" value="0" />
            )}
            <button type="button" onClick={() => setLines((p) => p.filter((_, j) => j !== i))} disabled={lines.length === 1} className="text-left text-sm text-zinc-400 hover:text-red-600 disabled:opacity-30">
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setLines((p) => [...p, blank()])} className="w-fit text-sm text-brand-600 hover:underline">
          + Add line
        </button>
        <p className="text-sm font-medium">Bill total: {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(total)}</p>
        <p className="text-xs text-zinc-500">Lines above the expense approval threshold need manager approval before the bill can be paid.</p>
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
        Notes
        <textarea name="notes" rows={2} className={fieldClass} />
      </label>
      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-fit rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
        {pending ? "Saving..." : "Record bill"}
      </button>
    </form>
  );
}
