"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordResetAction } from "@/lib/password-actions";
import { fieldClass } from "@/components/ActionForm";

export default function ForgotForm({ emailOn }: { emailOn: boolean }) {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, { error: null });
  if (state.done) {
    return (
      <div className="flex flex-col gap-3 text-sm text-zinc-600 dark:text-zinc-300">
        <p>
          {emailOn
            ? "If an account exists for that address, we've emailed a link to reset the password. It expires in 60 minutes -- check your spam folder too."
            : "If an account exists for that address, your administrator has been notified and will send you a reset link."}
        </p>
        <Link href="/login" className="text-brand-600 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <p className="text-sm text-zinc-500">Enter the email address you sign in with.</p>
      <input name="email" type="email" required autoComplete="email" placeholder="you@portsimex.com" className={`${fieldClass} py-2`} />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
        {pending ? "Sending..." : "Reset my password"}
      </button>
      <Link href="/login" className="text-center text-sm text-zinc-500 hover:underline">
        Back to sign in
      </Link>
    </form>
  );
}
