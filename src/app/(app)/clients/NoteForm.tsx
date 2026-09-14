"use client";

import { useActionState } from "react";
import { addClientNoteAction } from "./actions";

export default function NoteForm({ clientId }: { clientId: string }) {
  const boundAction = addClientNoteAction.bind(null, clientId);
  const [state, formAction, pending] = useActionState(boundAction, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <textarea
        name="body"
        required
        rows={2}
        placeholder="Log a call, an update, anything worth remembering..."
        className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
      />
      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Adding..." : "Add note"}
      </button>
    </form>
  );
}
