import Link from "next/link";
import { requirePermission } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { emailConfigured } from "@/lib/email";
import { Card, PageHeader } from "@/components/ui";
import ActionForm, { fieldClass } from "@/components/ActionForm";
import { LOGIN_RULES, PASSWORD_MIN_LENGTH } from "@/lib/security-rules";
import { saveSettingsAction } from "./actions";

export default async function SettingsPage() {
  await requirePermission("settings.manage");
  const s = await getSettings();
  return (
    <div>
      <PageHeader title="Settings" description="Approval limits and security" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <ActionForm action={saveSettingsAction} submitLabel="Save settings" keepValues className="flex flex-col gap-5">
            <div>
              <h2 className="mb-2 font-semibold">Approvals</h2>
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  Expenses above this amount need approval before they can be paid
                  <input name="expenseApprovalThreshold" type="number" min="0" step="0.01" defaultValue={s.expenseApprovalThreshold} className={`${fieldClass} w-40`} />
                  <span className="text-xs text-zinc-500">
                    Who may approve, and up to how much, is set per role under{" "}
                    <Link href="/users/roles" className="text-brand-600 hover:underline">
                      Users &amp; Roles
                    </Link>
                    .
                  </span>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Supplier payments, expense payouts and refunds above this amount need the &quot;Authorize payments&quot; permission
                  <input name="paymentAuthorizationThreshold" type="number" min="0" step="0.01" defaultValue={s.paymentAuthorizationThreshold} className={`${fieldClass} w-40`} />
                </label>
              </div>
            </div>
            <div>
              <h2 className="mb-2 font-semibold">Security</h2>
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  Sign-ins last this many hours, then people sign in again
                  <input name="sessionHours" type="number" min="1" max="720" step="1" defaultValue={s.sessionHours} className={`${fieldClass} w-32`} />
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="requireMfaForManagers" defaultChecked={s.requireMfaForManagers} className="mt-1" />
                  <span>
                    Require two-factor login for anyone who approves or moves money, or manages users and settings
                    <span className="block text-xs text-zinc-500">They can still use everything else; those actions ask them to set up two-factor first.</span>
                  </span>
                </label>
              </div>
            </div>
          </ActionForm>
        </Card>
        <Card className="flex flex-col gap-3 text-sm text-zinc-600 dark:text-zinc-300">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Always on</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Passwords: at least {PASSWORD_MIN_LENGTH} characters with letters and numbers; common passwords refused; stored only as a one-way hash.</li>
            <li>
              Sign-in is paused for {LOGIN_RULES.perAccount.windowMs / 60_000} minutes after {LOGIN_RULES.perAccount.limit} wrong attempts on one account, or{" "}
              {LOGIN_RULES.perIp.limit} failed attempts from one network.
            </li>
            <li>Changing or resetting a password, deactivating a user, or &quot;sign out of all devices&quot; ends their sessions immediately.</li>
            <li>Every permission is checked on the server for every page and action; the audit trail records sign-in security events and changes to users, roles and settings.</li>
          </ul>
          <h2 className="mt-2 font-semibold text-zinc-900 dark:text-zinc-50">Email</h2>
          {emailConfigured() ? (
            <p>Email is set up: password reset and confirmation links are sent by email.</p>
          ) : (
            <p>
              Email isn&apos;t set up, so &quot;Forgot password&quot; notifies administrators, who send a reset link from the user&apos;s page. To send emails
              automatically, add RESEND_API_KEY and EMAIL_FROM (and APP_URL) to the server&apos;s environment variables.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
