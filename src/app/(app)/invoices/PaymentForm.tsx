"use client";

import { useActionState } from "react";
import { addPaymentAction } from "./actions";

const METHODS = [
  "BANK_TRANSFER",
  "CASH",
  "CHECK",
  "CARD",
  "MOBILE_MONEY",
  "OTHER",
] as const;

export default function PaymentForm({ invoiceId }: { invoiceId: string }) {
  const boundAction = addPaymentAction.bind(null, invoiceId);
  const [state, formAction, pending] = useActionState(boundAction, { error: null });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="amount" className="text-xs font-medium text-zinc-500">
            Amount
          </label>
          <input
            id="amount"
            name="amount"
            type="number"
            min="0"
            step="0.01"
            required
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="paidAt" className="text-xs font-medium text-zinc-500">
            Date
          </label>
          <input
            id="paidAt"
            name="paidAt"
            type="date"
            required
            defaultValue={today}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="method" className="text-xs font-medium text-zinc-500">
            Method
          </label>
          <select
            id="method"
            name="method"
            defaultValue="BANK_TRANSFER"
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="reference" className="text-xs font-medium text-zinc-500">
            Reference
          </label>
          <input
            id="reference"
            name="reference"
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Recording..." : "Record payment"}
      </button>
    </form>
  );
}
