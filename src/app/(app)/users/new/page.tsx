import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { isFullAccessRole } from "@/lib/roles";
import { ensureAccessProfiles } from "@/lib/access-profiles";
import { PageHeader } from "@/components/ui";
import UserForm from "./UserForm";
import { createUserAction } from "../actions";

export default async function NewUserPage() {
  const me = await requirePermission("users.manage");
  await ensureAccessProfiles();
  const [ministries, clients, profiles] = await Promise.all([
    prisma.ministry.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.accessProfile.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, description: true } }),
  ]);

  return (
    <div>
      <PageHeader title="New user" description="Give a teammate access to Portsimex" />
      <UserForm action={createUserAction} ministries={ministries} clients={clients} profiles={profiles} canGrantSuperAdmin={isFullAccessRole(me.role)} submitLabel="Create user" />
    </div>
  );
}
