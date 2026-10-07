import { redirect } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import ActionForm, { fieldClass } from "@/components/ActionForm";
import { getCurrentUser } from "@/lib/session";
import { changePasswordAction } from "@/lib/password-actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/security-rules";

// Shown instead of the app until a user with a temporary password (set by
// an administrator) picks their own.
export default async function ChangePasswordPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login?ended=1");
  if (!me.mustChangePassword) redirect("/");
  return (
    <AuthCard title="Choose your own password">
      <ActionForm action={changePasswordAction} submitLabel="Save and sign in again" className="flex flex-col gap-3" buttonClassName="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
        <p className="text-sm text-zinc-500">
          Your account was set up with a temporary password. Replace it with one only you know (at least {PASSWORD_MIN_LENGTH} characters, letters and numbers).
        </p>
        <input name="current" type="password" required autoComplete="current-password" placeholder="Temporary password" className={`${fieldClass} py-2`} />
        <input name="password" type="password" required minLength={PASSWORD_MIN_LENGTH} autoComplete="new-password" placeholder="New password" className={`${fieldClass} py-2`} />
        <input name="confirm" type="password" required minLength={PASSWORD_MIN_LENGTH} autoComplete="new-password" placeholder="Repeat new password" className={`${fieldClass} py-2`} />
      </ActionForm>
    </AuthCard>
  );
}
