"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { isFullAccessRole } from "@/lib/roles";
import { audit } from "@/lib/audit";
import { isPermission, type Permission } from "@/lib/permission-catalog";
import { SERVICE_CATEGORIES } from "@/lib/service-templates";

type State = { error: string | null };
// Granting these is reserved for Super Admins (otherwise a user manager could give themselves anything).
const ADMIN_ONLY: Permission[] = ["users.manage", "settings.manage"];

export async function saveProfileAction(id: string | null, _prev: State, formData: FormData): Promise<State> {
  const me = await requirePermission("users.manage");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the role a name." };
  const permissions = formData.getAll("permissions").map(String).filter(isPermission);
  const jobCategories = formData
    .getAll("jobCategories")
    .map(String)
    .filter((c): c is (typeof SERVICE_CATEGORIES)[number] => (SERVICE_CATEGORIES as readonly string[]).includes(c));
  const limitRaw = String(formData.get("approvalLimit") ?? "").trim();
  const approvalLimit = limitRaw === "" ? null : Number(limitRaw);
  if (approvalLimit !== null && !(approvalLimit >= 0)) return { error: "The approval limit must be a positive amount (or empty for no limit)." };

  const before = id ? await prisma.accessProfile.findUniqueOrThrow({ where: { id } }) : null;
  if (!isFullAccessRole(me.role)) {
    const changedAdminOnly = ADMIN_ONLY.filter((p) => permissions.includes(p) !== (before?.permissions.includes(p) ?? false));
    if (changedAdminOnly.length) return { error: "Only a Super Admin can grant or remove user / settings management." };
  }
  const clash = await prisma.accessProfile.findFirst({ where: { name, ...(id ? { NOT: { id } } : {}) } });
  if (clash) return { error: "Another role already has that name." };

  const data = {
    name,
    description: String(formData.get("description") ?? "").trim() || null,
    permissions,
    jobCategories,
    assignedJobsOnly: formData.get("assignedJobsOnly") === "on",
    approvalLimit,
  };
  const saved = await prisma.$transaction(async (tx) => {
    const p = id ? await tx.accessProfile.update({ where: { id }, data }) : await tx.accessProfile.create({ data });
    await audit(tx, me, {
      action: id ? "ROLE_UPDATED" : "ROLE_CREATED",
      module: "Security",
      entityType: "AccessProfile",
      entityId: p.id,
      message: `${me.name} ${id ? "updated" : "created"} the role "${p.name}" (${permissions.length} permissions).`,
      before: before ? { permissions: before.permissions, jobCategories: before.jobCategories, assignedJobsOnly: before.assignedJobsOnly, approvalLimit: before.approvalLimit?.toString() ?? null } : undefined,
      after: { permissions, jobCategories, assignedJobsOnly: data.assignedJobsOnly, approvalLimit: approvalLimit?.toString() ?? null },
    });
    return p;
  });
  revalidatePath("/users/roles");
  if (!id) redirect(`/users/roles/${saved.id}`);
  return { error: null };
}

export async function deleteProfileAction(id: string, _prev: State): Promise<State> {
  const me = await requirePermission("users.manage");
  const p = await prisma.accessProfile.findUniqueOrThrow({ where: { id }, include: { _count: { select: { users: true } } } });
  if (p._count.users > 0) return { error: `${p._count.users} user(s) have this role -- move them to another role first.` };
  await prisma.$transaction(async (tx) => {
    await tx.accessProfile.delete({ where: { id } });
    await audit(tx, me, { action: "ROLE_DELETED", module: "Security", entityType: "AccessProfile", entityId: id, message: `${me.name} deleted the role "${p.name}".` });
  });
  revalidatePath("/users/roles");
  redirect("/users/roles");
}
