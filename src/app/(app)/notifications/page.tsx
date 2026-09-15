import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "./actions";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <PageHeader
        title="Notifications"
        action={
          notifications.some((n) => !n.read) ? (
            <form action={markAllNotificationsReadAction}>
              <button
                type="submit"
                className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Mark all read
              </button>
            </form>
          ) : undefined
        }
      />
      {notifications.length === 0 ? (
        <EmptyState message="No notifications yet." />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {notifications.map((n) => {
              const boundMarkOne = markNotificationReadAction.bind(null, n.id);
              return (
                <li
                  key={n.id}
                  className={`flex items-center justify-between gap-3 px-4 py-3 text-sm ${
                    n.read ? "" : "bg-brand-50 dark:bg-brand-950/40"
                  }`}
                >
                  <div>
                    <p className="text-zinc-900 dark:text-zinc-50">{n.message}</p>
                    <p className="text-xs text-zinc-500">{formatDate(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <form action={boundMarkOne}>
                      <button
                        type="submit"
                        className="shrink-0 text-xs text-brand-700 hover:underline dark:text-brand-300"
                      >
                        Mark read
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
