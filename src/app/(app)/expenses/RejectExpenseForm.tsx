"use client";

import { useActionState } from "react";

type ActionState = { error: string | null };
type RejectAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export default function RejectExpenseForm({ action }: { action: RejectAction }) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <label htmlFor="reason" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Reject with a reason
      </label>
      <textarea
        id="reason"
        name="reason"
        rows={2}
        required
        placeholder="Why is this expense being rejected?"
        className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
      />
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
      >
        {pending ? "Rejecting..." : "Reject"}
      </button>
      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
    </form>
  );
}
