"use client";

import { useActionState } from "react";

type ActionState = { error: string | null };
type BoundAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export default function SimpleActionButton({
  action,
  label,
  pendingLabel,
  className,
  confirmMessage,
}: {
  action: BoundAction;
  label: string;
  pendingLabel?: string;
  className?: string;
  confirmMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirmMessage && !confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        disabled={pending}
        className={
          className ??
          "rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        }
      >
        {pending ? (pendingLabel ?? "Working...") : label}
      </button>
      {state.error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
