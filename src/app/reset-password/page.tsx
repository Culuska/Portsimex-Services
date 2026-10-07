import Link from "next/link";
import AuthCard from "@/components/AuthCard";
import ActionForm, { fieldClass } from "@/components/ActionForm";
import { findValidResetToken } from "@/lib/auth-tokens";
import { resetPasswordAction } from "@/lib/password-actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/security-rules";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const row = await findValidResetToken(token);
  if (!row) {
    return (
      <AuthCard title="Link expired">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">This reset link has expired or was already used.</p>
        <Link href="/forgot-password" className="mt-3 inline-block text-sm text-brand-600 hover:underline">
          Ask for a new link
        </Link>
      </AuthCard>
    );
  }
  return (
    <AuthCard title={`Choose a new password, ${row.user.name.split(" ")[0]}`}>
      <ActionForm action={resetPasswordAction.bind(null, token)} submitLabel="Save new password" className="flex flex-col gap-3" buttonClassName="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
        <p className="text-sm text-zinc-500">At least {PASSWORD_MIN_LENGTH} characters, with letters and numbers. You&apos;ll be signed out of other devices.</p>
        <input name="password" type="password" required minLength={PASSWORD_MIN_LENGTH} autoComplete="new-password" placeholder="New password" className={`${fieldClass} py-2`} />
        <input name="confirm" type="password" required minLength={PASSWORD_MIN_LENGTH} autoComplete="new-password" placeholder="Repeat new password" className={`${fieldClass} py-2`} />
      </ActionForm>
    </AuthCard>
  );
}
