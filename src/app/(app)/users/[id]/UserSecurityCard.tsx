"use client";

import { useActionState } from "react";
import { createResetLinkAction, resetUserMfaAction, signOutUserEverywhereAction } from "@/lib/password-actions";

const btn = "rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800";

export default function UserSecurityCard({
  userId,
  name,
  isSelf,
  mfaOn,
  lastLoginAt,
  emailVerifiedAt,
  active,
}: {
  userId: string;
  name: string;
  isSelf: boolean;
  mfaOn: boolean;
  lastLoginAt: Date | null;
  emailVerifiedAt: Date | null;
  active: boolean;
}) {
  const [link, makeLink, making] = useActionState(createResetLinkAction.bind(null, userId), { error: null });
  const [signedOut, signOut, signingOut] = useActionState(signOutUserEverywhereAction.bind(null, userId), { error: null });
  const [mfaReset, resetMfa, resettingMfa] = useActionState(resetUserMfaAction.bind(null, userId), { error: null });
  const when = (d: Date | null) => (d ? new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "never");

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-1 font-semibold">Security</h2>
      <p className="mb-4 text-sm text-zinc-500">
        Last sign-in: {when(lastLoginAt)} · Two-factor: {mfaOn ? "on" : "off"} · Email {emailVerifiedAt ? "confirmed" : "not confirmed"}
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-medium">Forgotten password</p>
          <p className="text-zinc-500">Create a one-time link (valid 24 hours) and send it to {name.split(" ")[0]} by WhatsApp or SMS. Passwords are never shown or stored readable.</p>
          {link.link ? (
            <div className="flex flex-col gap-1">
              <input readOnly value={link.link} onFocus={(e) => e.currentTarget.select()} className="w-full rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900" data-testid="reset-link" />
              <button type="button" className="w-fit text-xs text-brand-600 hover:underline" onClick={() => navigator.clipboard?.writeText(link.link!)}>
                Copy link
              </button>
            </div>
          ) : (
            <form action={makeLink}>
              <button type="submit" disabled={making || !active} className={btn}>
                Create password reset link
              </button>
            </form>
          )}
          {link.error && <p className="text-red-600">{link.error}</p>}
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-medium">Sessions</p>
          <p className="text-zinc-500">Signs {isSelf ? "you" : name.split(" ")[0]} out on every device (e.g. a lost phone or a shared computer).</p>
          <form action={signOut}>
            <button type="submit" disabled={signingOut} className={btn}>
              Sign out of all devices
            </button>
          </form>
          {signedOut.done && <p className="text-emerald-700">Done -- they&apos;ll need to sign in again.</p>}
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-medium">Two-factor login</p>
          {mfaOn ? (
            <>
              <p className="text-zinc-500">Lost their phone and recovery codes? Turn two-factor off so they can sign in and set it up again.</p>
              <form action={resetMfa} onSubmit={(e) => !confirm(`Turn off two-factor login for ${name}?`) && e.preventDefault()}>
                <button type="submit" disabled={resettingMfa || !!mfaReset.done} className={btn}>
                  Reset two-factor
                </button>
              </form>
              {mfaReset.done && <p className="text-emerald-700">Two-factor turned off.</p>}
            </>
          ) : (
            <p className="text-zinc-500">Not turned on. They can set it up under My account.</p>
          )}
        </div>
      </div>
    </div>
  );
}
