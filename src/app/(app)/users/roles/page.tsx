import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ensureAccessProfiles } from "@/lib/access-profiles";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import { SERVICE_CATEGORY_LABELS } from "@/lib/service-templates";
import UsersTabs from "../UsersTabs";

export default async function RolesPage() {
  await requirePermission("users.manage");
  await ensureAccessProfiles();
  const profiles = await prisma.accessProfile.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { users: true } } } });
  return (
    <div>
      <PageHeader
        title="Users & Roles"
        description="Each role is a job title with its own permissions, the service lines it works on, and how much it may approve"
        action={<ButtonLink href="/users/roles/new">New role</ButtonLink>}
      />
      <UsersTabs active="roles" />
      <Card className="mb-4 text-sm text-zinc-600 dark:text-zinc-300">
        <strong>Super Admin</strong> (Admin / Supervisor accounts) can do everything. Staff without a role keep the original staff access.
      </Card>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
            <tr>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Jobs</th>
              <th className="px-4 py-3 font-medium text-right">Permissions</th>
              <th className="px-4 py-3 font-medium text-right">Approves up to</th>
              <th className="px-4 py-3 font-medium text-right">Users</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {profiles.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3">
                  <Link href={`/users/roles/${p.id}`} className="font-medium text-brand-600 hover:underline">
                    {p.name}
                  </Link>
                  {p.description && <p className="text-xs text-zinc-500">{p.description}</p>}
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  {p.jobCategories.length ? p.jobCategories.map((c) => SERVICE_CATEGORY_LABELS[c]).join(", ") : "All service lines"}
                  {p.assignedJobsOnly ? " · only their own" : ""}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{p.permissions.length}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {p.permissions.includes("expenses.approve") ? (p.approvalLimit === null ? "No limit" : formatCurrency(Number(p.approvalLimit))) : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{p._count.users}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
