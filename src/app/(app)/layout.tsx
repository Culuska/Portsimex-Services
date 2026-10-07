import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentUser, MFA_GUARDED } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { hasPermission } from "@/lib/permission-catalog";
import { prisma } from "@/lib/prisma";
import Nav from "@/components/Nav";
import SignOutButton from "@/components/SignOutButton";
import MobileMenu from "@/components/MobileMenu";
import { runDailyReminders } from "@/lib/reminders";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  // The cookie alone isn't trusted: the account must still be active and
  // the session not revoked or expired (see lib/session.ts).
  const me = await getCurrentUser();
  if (!me) redirect("/login?ended=1");
  if (me.mustChangePassword) redirect("/change-password");
  const settings = await getSettings();
  const managesMoney = MFA_GUARDED.some((p) => hasPermission(me.grant, p));
  const mfaNudge = settings.requireMfaForManagers && managesMoney && !me.mfaEnabled;

  // Automatic daily reminders (follow-ups, expiring documents, overdue
  // tasks/jobs). Runs at most once per day across all users; a failure here
  // must never stop the page from loading.
  if (["ADMIN", "SUPERVISOR", "STAFF"].includes(session.user.role)) {
    try {
      await runDailyReminders();
    } catch (error) {
      console.error("[reminders]", error);
    }
  }

  const unreadCount = await prisma.notification.count({
    where: { userId: session.user.id, read: false },
  });

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black sm:flex-row">
      <div className="print:hidden">
        <MobileMenu
          role={session.user.role}
          permissions={me.grant.permissions}
          fullAccess={me.grant.fullAccess}
          userName={session.user.name}
          userRole={session.user.role}
          unreadCount={unreadCount}
        />
      </div>
      <aside className="hidden print:!hidden w-56 shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 sm:flex sm:flex-col sm:justify-between">
        <div>
          <div className="px-3 pb-6">
            <p className="text-sm font-semibold text-brand-800 dark:text-brand-200">
              Portsimex <span className="text-accent-600">Services</span>
            </p>
            <p className="text-[10px] font-medium text-zinc-400">Your World brought closer</p>
          </div>
          <Nav role={session.user.role} permissions={me.grant.permissions} fullAccess={me.grant.fullAccess} />
        </div>
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 px-3">
          <Link
            href="/notifications"
            className="mb-3 flex items-center justify-between rounded-md px-1 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Notifications
            {unreadCount > 0 && (
              <span className="rounded-full bg-accent-600 px-2 py-0.5 text-xs font-medium text-white">
                {unreadCount}
              </span>
            )}
          </Link>
          <Link href="/account" className="block rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{me.name}</p>
            <p className="text-xs text-zinc-500">{me.profileName ?? me.role} · My account</p>
          </Link>
          <div className="mt-2">
            <SignOutButton />
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden p-4 sm:p-8 print:p-0">
        {mfaNudge && (
          <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 print:hidden dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Your role can approve or move money, so two-factor login is required for those actions.{" "}
            <Link href="/account" className="font-medium underline">
              Set it up now
            </Link>
            .
          </p>
        )}
        {children}
      </main>
    </div>
  );
}
