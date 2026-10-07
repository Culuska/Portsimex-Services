import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import ActionForm, { fieldClass } from "@/components/ActionForm";
import { formatDate } from "@/lib/format";
import { emailConfigured } from "@/lib/email";
import { mfaKey } from "@/lib/login";
import { decryptSecret, otpauthUri } from "@/lib/totp";
import { PASSWORD_MIN_LENGTH } from "@/lib/security-rules";
import { changePasswordAction, sendVerificationEmailAction } from "@/lib/password-actions";
import {
  cancelMfaSetupAction,
  confirmMfaAction,
  disableMfaAction,
  regenerateRecoveryCodesAction,
  signOutEverywhereAction,
  startMfaSetupAction,
} from "@/lib/mfa-actions";
import CodesForm from "./CodesForm";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ mfa?: string }> }) {
  const me = await requireUser();
  const { mfa } = await searchParams;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
  let setup: { svg: string; key: string } | null = null;
  if (user.mfaPendingSecret && !user.mfaEnabledAt) {
    const key = decryptSecret(user.mfaPendingSecret, mfaKey());
    setup = { key, svg: await QRCode.toString(otpauthUri(key, user.email), { type: "svg", margin: 1, width: 180 }) };
  }

  return (
    <div>
      <PageHeader title="My account" description={`${user.name} · ${user.email} · ${me.profileName ?? user.role}`} />
      {mfa === "required" && !user.mfaEnabledAt && (
        <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          That action approves or moves money, so it needs two-factor login. Set it up below, then try again.
        </p>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-1 font-semibold">Password</h2>
          <p className="mb-3 text-sm text-zinc-500">
            {user.passwordChangedAt ? `Last changed ${formatDate(user.passwordChangedAt)}. ` : ""}At least {PASSWORD_MIN_LENGTH} characters, with letters and
            numbers. Changing it signs you out everywhere.
          </p>
          <ActionForm action={changePasswordAction} submitLabel="Change password" className="flex flex-col gap-3">
            <input name="current" type="password" required autoComplete="current-password" placeholder="Current password" className={fieldClass} />
            <input name="password" type="password" required minLength={PASSWORD_MIN_LENGTH} autoComplete="new-password" placeholder="New password" className={fieldClass} />
            <input name="confirm" type="password" required minLength={PASSWORD_MIN_LENGTH} autoComplete="new-password" placeholder="Repeat new password" className={fieldClass} />
          </ActionForm>
        </Card>

        <Card>
          <h2 className="mb-1 font-semibold">Two-factor login</h2>
          {user.mfaEnabledAt ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                On since {formatDate(user.mfaEnabledAt)}. Signing in needs your password and a code from your authenticator app. {user.mfaRecoveryCodes.length} recovery
                code{user.mfaRecoveryCodes.length === 1 ? "" : "s"} left.
              </p>
              <details>
                <summary className="cursor-pointer text-sm text-brand-600">New recovery codes…</summary>
                <div className="mt-2">
                  <CodesForm action={regenerateRecoveryCodesAction} submitLabel="Create new codes" intro="Your old recovery codes will stop working." />
                </div>
              </details>
              <details>
                <summary className="cursor-pointer text-sm text-red-600">Turn off two-factor login…</summary>
                <ActionForm action={disableMfaAction} submitLabel="Turn off" className="mt-2 flex flex-col gap-2" buttonClassName="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">
                  <input name="password" type="password" required placeholder="Your password" className={fieldClass} />
                  <input name="code" required inputMode="numeric" placeholder="Current 6-digit code" className={fieldClass} />
                </ActionForm>
              </details>
            </div>
          ) : setup ? (
            <div className="flex flex-col gap-3 text-sm">
              <p className="text-zinc-500">
                1. Open an authenticator app (Google Authenticator, Microsoft Authenticator, Authy…) and scan this code, or enter the key by hand.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <div className="rounded bg-white p-2" dangerouslySetInnerHTML={{ __html: setup.svg }} />
                <div>
                  <p className="text-xs text-zinc-500">Setup key</p>
                  <p className="break-all font-mono text-base" data-testid="mfa-key">
                    {setup.key.match(/.{1,4}/g)?.join(" ")}
                  </p>
                </div>
              </div>
              <CodesForm action={confirmMfaAction} submitLabel="Turn on" intro="2. Enter the 6-digit code the app shows." />
              <form action={cancelMfaSetupAction}>
                <button type="submit" className="text-sm text-zinc-500 hover:underline">
                  Cancel
                </button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-zinc-500">
                Protect your account even if your password is stolen: after your password, you&apos;ll enter a code from an app on your phone.
              </p>
              <form action={startMfaSetupAction}>
                <button type="submit" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                  Set up two-factor login
                </button>
              </form>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-1 font-semibold">Email address</h2>
          {user.emailVerifiedAt ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">{user.email} -- confirmed {formatDate(user.emailVerifiedAt)}.</p>
          ) : (
            <div className="flex flex-col gap-2 text-sm">
              <p className="text-zinc-500">{user.email} -- not confirmed yet. Password reset emails only go to a confirmed address you can read.</p>
              {emailConfigured() && <ActionForm action={sendVerificationEmailAction} submitLabel="Send confirmation email" />}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-1 font-semibold">Sessions</h2>
          <p className="mb-3 text-sm text-zinc-500">
            {user.lastLoginAt ? `Last sign-in ${user.lastLoginAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}. ` : ""}
            Signed in on a shared or lost device? Sign out everywhere -- including here.
          </p>
          <form action={signOutEverywhereAction}>
            <button type="submit" className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
              Sign out of all devices
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
