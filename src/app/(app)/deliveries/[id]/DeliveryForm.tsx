"use client";

import { useActionState } from "react";

type ActionState = { error: string | null };
type BoundAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export default function DeliveryForm({ action }: { action: BoundAction }) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-3 max-w-sm">
      <div className="flex flex-col gap-1">
        <label htmlFor="deliveryMode" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Delivery mode
        </label>
        <select
          id="deliveryMode"
          name="deliveryMode"
          required
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="AIRPORT">Airport</option>
          <option value="SEAPORT">Seaport</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="destinationDetail" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Destination detail
        </label>
        <input
          id="destinationDetail"
          name="destinationDetail"
          required
          placeholder="e.g. Terminal 2, Gate B / Berth 4"
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Create delivery record"}
      </button>
    </form>
  );
}
