"use client";

import { useActionState } from "react";
import { fieldClass } from "@/components/ActionForm";

type CodesState = { error: string | null; codes?: string[] };

// Submits a 6-digit code; on success shows the recovery codes exactly once.
export default function CodesForm({
  action,
  submitLabel,
  intro,
}: {
  action: (state: CodesState, formData: FormData) => Promise<CodesState>;
  submitLabel: string;
  intro?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  if (state.codes) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-800 dark:bg-emerald-950">
        <p className="font-semibold text-emerald-900 dark:text-emerald-200">Save your recovery codes</p>
        <p className="text-emerald-900 dark:text-emerald-200">
          If you lose your phone, each of these codes lets you sign in once. Keep them somewhere safe (printed, or in a password manager). They
          won&apos;t be shown again.
        </p>
        <ul className="grid grid-cols-2 gap-1 font-mono text-base">
          {state.codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <a href="/account" className="w-fit rounded-md bg-brand-600 px-3 py-1.5 text-white hover:bg-brand-700">
          I&apos;ve saved them
        </a>
      </div>
    );
  }
  return (
    <form action={formAction} className="flex flex-col gap-2">
      {intro && <p className="text-sm text-zinc-500">{intro}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <input name="code" required inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" className={`${fieldClass} w-36 tracking-widest`} />
        <button type="submit" disabled={pending} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          {pending ? "Checking..." : submitLabel}
        </button>
      </div>
      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
    </form>
  );
}
