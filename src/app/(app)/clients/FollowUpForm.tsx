"use client";

import { useActionState } from "react";
import { addFollowUpAction } from "./actions";

export default function FollowUpForm({ clientId }: { clientId: string }) {
  const boundAction = addFollowUpAction.bind(null, clientId);
  const [state, formAction, pending] = useActionState(boundAction, { error: null });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          name="dueDate"
          type="date"
          required
          defaultValue={today}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />
        <input
          name="note"
          required
          placeholder="Follow up about..."
          className="flex-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Adding..." : "Add follow-up"}
      </button>
    </form>
  );
}
