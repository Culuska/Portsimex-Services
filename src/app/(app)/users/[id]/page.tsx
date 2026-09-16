import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isFullAccessRole } from "@/lib/roles";
import { Badge, Card, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";
import SimpleActionButton from "@/components/SimpleActionButton";
import UserForm from "../new/UserForm";
import {
  updateUserAction,
  deactivateUserAction,
  reactivateUserAction,
  deleteUserAction,
} from "../actions";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session || !isFullAccessRole(session.user.role)) {
    redirect("/");
  }

  const [user, ministries, clients] = await Promise.all([
    prisma.user.findUnique({ where: { id } }),
    prisma.ministry.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!user) notFound();

  const isSelf = session.user.id === user.id;
  const boundUpdate = updateUserAction.bind(null, user.id);
  const boundDeactivate = deactivateUserAction.bind(null, user.id);
  const boundReactivate = reactivateUserAction.bind(null, user.id);
  const boundDelete = deleteUserAction.bind(null, user.id);

  return (
    <div>
      <PageHeader
        title={user.name}
        description={`Joined ${formatDate(user.createdAt)}`}
        action={<Badge status={user.active ? "ACTIVE" : "INACTIVE"} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">Edit user</h2>
          <UserForm
            action={boundUpdate}
            ministries={ministries}
            clients={clients}
            submitLabel="Save changes"
            defaultValues={{
              name: user.name,
              email: user.email,
              role: user.role,
              ministryId: user.ministryId,
              vendorClientId: user.vendorClientId,
            }}
          />
        </Card>

        <Card className="flex flex-col gap-6">
          <div>
            <h2 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-50">Access</h2>
            {isSelf ? (
              <p className="text-sm text-zinc-500">
                This is your own account -- deactivating or deleting it isn&apos;t allowed here.
              </p>
            ) : user.active ? (
              <>
                <p className="mb-3 text-sm text-zinc-500">
                  Revokes login immediately. Everything this user created or approved stays in
                  place.
                </p>
                <form action={boundDeactivate}>
                  <button
                    type="submit"
                    className="rounded-md border border-amber-300 dark:border-amber-800 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                  >
                    Deactivate
                  </button>
                </form>
              </>
            ) : (
              <>
                <p className="mb-3 text-sm text-zinc-500">
                  This account is deactivated and cannot log in.
                </p>
                <form action={boundReactivate}>
                  <button
                    type="submit"
                    className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                  >
                    Reactivate
                  </button>
                </form>
              </>
            )}
          </div>

          {!isSelf && (
            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
              <h2 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-50">
                Delete account
              </h2>
              <p className="mb-3 text-sm text-zinc-500">
                Only possible if this user has never created or approved anything -- otherwise
                deactivate instead, to keep the audit trail intact.
              </p>
              <SimpleActionButton
                action={boundDelete}
                label="Delete user"
                pendingLabel="Deleting..."
                confirmMessage={`Permanently delete ${user.name}? This cannot be undone.`}
                className="rounded-md border border-red-300 dark:border-red-800 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
              />
            </div>
          )}
        </Card>
      </div>

      <Link
        href="/users"
        className="mt-6 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400"
      >
        Back to Users
      </Link>
    </div>
  );
}
