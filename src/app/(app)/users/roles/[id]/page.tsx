import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import SimpleActionButton from "@/components/SimpleActionButton";
import ProfileForm from "../ProfileForm";
import { deleteProfileAction, saveProfileAction } from "../actions";

export default async function RolePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("users.manage");
  const { id } = await params;
  const p = await prisma.accessProfile.findUnique({ where: { id }, include: { users: { select: { id: true, name: true, active: true }, orderBy: { name: "asc" } } } });
  if (!p) notFound();
  return (
    <div>
      <PageHeader title={p.name} description={p.description ?? "Role"} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <ProfileForm
            action={saveProfileAction.bind(null, p.id)}
            submitLabel="Save role"
            profile={{ ...p, approvalLimit: p.approvalLimit === null ? null : Number(p.approvalLimit) }}
          />
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold">People with this role</h2>
          {p.users.length === 0 ? (
            <p className="text-sm text-zinc-500">Nobody yet. Assign it on a user&apos;s page.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {p.users.map((u) => (
                <li key={u.id}>
                  <Link href={`/users/${u.id}`} className="text-brand-600 hover:underline">
                    {u.name}
                  </Link>
                  {!u.active && <span className="text-zinc-500"> (inactive)</span>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-zinc-500">Changes apply immediately, the next time each person opens a page.</p>
          {p.users.length === 0 && (
            <div className="mt-4">
              <SimpleActionButton action={deleteProfileAction.bind(null, p.id)} label="Delete role" pendingLabel="Deleting..." confirmMessage={`Delete the role "${p.name}"?`} className="text-sm text-red-600 hover:underline" />
            </div>
          )}
        </Card>
      </div>
      <Link href="/users/roles" className="mt-4 inline-block text-sm text-brand-600 hover:underline">
        ← Roles
      </Link>
    </div>
  );
}
