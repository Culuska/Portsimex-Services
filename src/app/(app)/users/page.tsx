import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { formatDate } from "@/lib/format";
import { Badge, ButtonLink, Card, PageHeader } from "@/components/ui";

export default async function UsersPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    redirect("/");
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { ministry: true, vendorClient: true },
  });

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage who can access Portsimex Ops & Finance"
        action={<ButtonLink href="/users/new">New user</ButtonLink>}
      />
      <Card className="p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Scope</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <Link
                    href={`/users/${u.id}`}
                    className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                  >
                    {u.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-500">{u.email}</td>
                <td className="px-4 py-3 text-zinc-500">{u.role.replace(/_/g, " ")}</td>
                <td className="px-4 py-3 text-zinc-500">
                  {u.ministry?.name ?? u.vendorClient?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-zinc-500">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-3">
                  <Badge status={u.active ? "ACTIVE" : "INACTIVE"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
