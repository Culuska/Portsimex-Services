import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { isFullAccessRole } from "@/lib/roles";
import { formatDate } from "@/lib/format";
import { Badge, ButtonLink, Card, PageHeader } from "@/components/ui";
import UsersTabs from "./UsersTabs";

export default async function UsersPage() {
  await requirePermission("users.manage");
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { ministry: true, vendorClient: true, accessProfile: true },
  });

  return (
    <div>
      <PageHeader title="Users & Roles" description="Who can sign in, and what each person is allowed to do" action={<ButtonLink href="/users/new">New user</ButtonLink>} />
      <UsersTabs active="users" />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Two-factor</th>
              <th className="px-4 py-3 font-medium">Last sign-in</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <Link href={`/users/${u.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
                    {u.name}
                  </Link>
                  <p className="text-xs text-zinc-500">
                    {u.email}
                    {u.emailVerifiedAt ? " · confirmed" : ""}
                  </p>
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                  {isFullAccessRole(u.role) ? "Super Admin" : u.role === "STAFF" ? (u.accessProfile?.name ?? "Staff (original access)") : u.role.replace(/_/g, " ").toLowerCase()}
                  {(u.ministry || u.vendorClient) && <p className="text-xs text-zinc-500">{u.ministry?.name ?? u.vendorClient?.name}</p>}
                </td>
                <td className="px-4 py-3 text-zinc-500">{u.mfaEnabledAt ? "On" : "Off"}</td>
                <td className="px-4 py-3 text-zinc-500">{u.lastLoginAt ? formatDate(u.lastLoginAt) : "Never"}</td>
                <td className="px-4 py-3">
                  <Badge status={u.active ? "ACTIVE" : "INACTIVE"} />
                  {u.mustChangePassword && <p className="mt-1 text-xs text-amber-700">temporary password</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
