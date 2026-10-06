"use client";

import { useActionState, useEffect, useRef } from "react";

type State = { error: string | null };

// Generic server-action form: renders the given fields, a submit button and
// any validation error returned by the action. Resets the fields after a
// successful submit unless `keepValues` is set.
export default function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel,
  className = "flex flex-col gap-3",
  buttonClassName,
  confirmMessage,
  keepValues = false,
  readOnly = false,
}: {
  action: (state: State, formData: FormData) => Promise<State>;
  children?: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  buttonClassName?: string;
  confirmMessage?: string;
  keepValues?: boolean;
  // Show the fields disabled with no submit button (e.g. on a closed job).
  readOnly?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const ref = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    if (!pending && submitted.current && !state.error && !keepValues) ref.current?.reset();
    if (!pending) submitted.current = false;
  }, [pending, state, keepValues]);

  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirmMessage && !confirm(confirmMessage)) {
          e.preventDefault();
          return;
        }
        submitted.current = true;
      }}
    >
      <fieldset disabled={readOnly} className="contents">
        {children}
      </fieldset>
      <div hidden={readOnly}>
        <button
          type="submit"
          disabled={pending}
          className={
            buttonClassName ??
            "rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          }
        >
          {pending ? (pendingLabel ?? "Saving...") : submitLabel}
        </button>
      </div>
      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
    </form>
  );
}

export const fieldClass =
  "rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-500";
