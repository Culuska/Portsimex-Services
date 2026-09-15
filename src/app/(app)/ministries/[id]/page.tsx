import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageMinistries } from "@/lib/permissions";
import { Card, PageHeader } from "@/components/ui";
import MinistryForm from "../MinistryForm";
import { updateMinistryAction } from "../actions";

export default async function MinistryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session || !canManageMinistries(session.user.role)) {
    redirect("/");
  }

  const { id } = await params;
  const ministry = await prisma.ministry.findUnique({
    where: { id },
    include: { users: true },
  });

  if (!ministry) notFound();

  const boundUpdate = updateMinistryAction.bind(null, ministry.id);

  return (
    <div>
      <PageHeader title={ministry.name} description={ministry.code} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">Edit ministry</h2>
          <MinistryForm
            action={boundUpdate}
            defaultValues={ministry}
            submitLabel="Save changes"
          />
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
            Ministry users
          </h2>
          {ministry.users.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No users assigned yet. Create one from Users → New user, and select this
              ministry.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
              {ministry.users.map((u) => (
                <li key={u.id} className="py-2 text-sm">
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">{u.name}</p>
                  <p className="text-xs text-zinc-500">
                    {u.email} · {u.role.replace(/_/g, " ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
