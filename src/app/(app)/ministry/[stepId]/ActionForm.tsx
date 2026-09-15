"use client";

import { useActionState } from "react";

type ActionState = { error: string | null };
type BoundAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export default function ActionForm({ action }: { action: BoundAction }) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="action" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Decision
        </label>
        <select
          id="action"
          name="action"
          required
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="APPROVE">Approve</option>
          <option value="REJECT">Reject</option>
          <option value="REQUEST_CORRECTION">Request correction</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="note" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Note (required)
        </label>
        <textarea
          id="note"
          name="note"
          required
          rows={3}
          placeholder="Explain the decision -- this is added to the permanent record and shown to the vendor."
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
        {pending ? "Submitting..." : "Submit decision"}
      </button>
    </form>
  );
}
