import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Nav from "@/components/Nav";
import SignOutButton from "@/components/SignOutButton";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const isAdmin = session.user.role === "ADMIN";

  return (
    <div className="flex flex-1 bg-zinc-50 dark:bg-black">
      <aside className="hidden w-56 shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 sm:flex sm:flex-col sm:justify-between">
        <div>
          <div className="px-3 pb-6">
            <p className="text-sm font-semibold text-brand-800 dark:text-brand-200">
              Portsimex <span className="text-accent-600">Services</span>
            </p>
            <p className="text-[10px] font-medium text-zinc-400">Your World brought closer</p>
          </div>
          <Nav isAdmin={isAdmin} />
        </div>
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 px-3">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {session.user.name}
          </p>
          <p className="text-xs text-zinc-500">{session.user.role}</p>
          <div className="mt-2">
            <SignOutButton />
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden p-4 sm:p-8">{children}</main>
    </div>
  );
}
