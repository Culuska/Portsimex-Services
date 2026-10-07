"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission, type CurrentUser } from "@/lib/session";
import { ROLES, isFullAccessRole } from "@/lib/roles";
import { checkPassword } from "@/lib/security-rules";
import { audit } from "@/lib/audit";

const userSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Valid email is required"),
  password: z.string(),
  role: z.enum(ROLES),
  accessProfileId: z.string().optional().or(z.literal("")),
  ministryId: z.string().optional().or(z.literal("")),
  vendorClientId: z.string().optional().or(z.literal("")),
  mustChangePassword: z.boolean(),
});

function assertScopeForRole(data: { role: string; ministryId?: string; vendorClientId?: string }) {
  if ((data.role === "MINISTRY_OFFICER" || data.role === "MINISTRY_REGISTRAR") && !data.ministryId) {
    return "Select a ministry for this role";
  }
  if (data.role === "VENDOR" && !data.vendorClientId) {
    return "Select a vendor company for this role";
  }
  return null;
}

// Only a Super Admin can create or change Super Admins -- otherwise anyone
// with "manage users" could promote themselves.
function escalationError(me: CurrentUser, targetRole: string, currentRole?: string) {
  if (isFullAccessRole(me.role)) return null;
  if (isFullAccessRole(targetRole) || (currentRole && isFullAccessRole(currentRole))) return "Only a Super Admin can create or change Admin / Supervisor accounts.";
  return null;
}

function parse(formData: FormData) {
  return userSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password") ?? "",
    role: formData.get("role"),
    accessProfileId: formData.get("accessProfileId") || "",
    // Only in the DOM for Ministry / Vendor roles -- formData.get() is then null.
    ministryId: formData.get("ministryId") || "",
    vendorClientId: formData.get("vendorClientId") || "",
    mustChangePassword: formData.get("mustChangePassword") === "on",
  });
}

const describe = (u: { name: string; email: string; role: string; accessProfileId: string | null; active?: boolean }) => ({
  name: u.name,
  email: u.email,
  role: u.role,
  accessProfileId: u.accessProfileId,
  ...(u.active !== undefined ? { active: u.active } : {}),
});

export async function createUserAction(_prevState: { error: string | null }, formData: FormData): Promise<{ error: string | null }> {
  const me = await requirePermission("users.manage");
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const d = parsed.data;
  const scopeError = assertScopeForRole(d) ?? escalationError(me, d.role);
  if (scopeError) return { error: scopeError };
  const problem = checkPassword(d.password, { email: d.email, name: d.name });
  if (problem) return { error: `Temporary password: ${problem}` };
  if (await prisma.user.findUnique({ where: { email: d.email.toLowerCase() } })) return { error: "A user with that email already exists." };

  await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: d.name,
        email: d.email.toLowerCase(),
        passwordHash: await bcrypt.hash(d.password, 12),
        role: d.role,
        accessProfileId: d.role === "STAFF" ? d.accessProfileId || null : null,
        ministryId: d.ministryId || null,
        vendorClientId: d.vendorClientId || null,
        mustChangePassword: d.mustChangePassword,
      },
    });
    await audit(tx, me, {
      action: "USER_CREATED",
      module: "Security",
      entityType: "User",
      entityId: created.id,
      message: `${me.name} created the account for ${created.name} (${created.email}).`,
      after: describe(created),
    });
  });

  revalidatePath("/users");
  redirect("/users");
}

export async function updateUserAction(id: string, _prevState: { error: string | null }, formData: FormData): Promise<{ error: string | null }> {
  const me = await requirePermission("users.manage");
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const d = parsed.data;
  const before = await prisma.user.findUniqueOrThrow({ where: { id } });
  const scopeError = assertScopeForRole(d) ?? escalationError(me, d.role, before.role);
  if (scopeError) return { error: scopeError };
  if (me.id === id && d.role !== before.role) return { error: "You can't change your own role." };
  if (d.password) {
    const problem = checkPassword(d.password, { email: d.email, name: d.name });
    if (problem) return { error: `New password: ${problem}` };
  }
  const existing = await prisma.user.findUnique({ where: { email: d.email.toLowerCase() } });
  if (existing && existing.id !== id) return { error: "A user with that email already exists." };

  await prisma.$transaction(async (tx) => {
    const after = await tx.user.update({
      where: { id },
      data: {
        name: d.name,
        email: d.email.toLowerCase(),
        role: d.role,
        accessProfileId: d.role === "STAFF" ? d.accessProfileId || null : null,
        ministryId: d.ministryId || null,
        vendorClientId: d.vendorClientId || null,
        ...(d.email.toLowerCase() !== before.email ? { emailVerifiedAt: null } : {}),
        // A password set by an administrator is temporary; it also ends the user's other sessions.
        ...(d.password
          ? { passwordHash: await bcrypt.hash(d.password, 12), mustChangePassword: d.mustChangePassword, passwordChangedAt: new Date(), sessionVersion: { increment: 1 } }
          : {}),
      },
    });
    await audit(tx, me, {
      action: "USER_UPDATED",
      module: "Security",
      entityType: "User",
      entityId: id,
      message: `${me.name} updated ${after.name}'s account${d.password ? " and set a new password" : ""}.`,
      before: describe(before),
      after: describe(after),
    });
  });

  revalidatePath("/users");
  revalidatePath(`/users/${id}`);
  return { error: null };
}

export async function deactivateUserAction(id: string) {
  const me = await requirePermission("users.manage");
  if (me.id === id) throw new Error("You cannot deactivate your own account.");
  const target = await prisma.user.findUniqueOrThrow({ where: { id } });
  if (escalationError(me, target.role)) redirect("/no-access?need=admin");
  await prisma.$transaction(async (tx) => {
    // Deactivating also ends every session the user has open.
    await tx.user.update({ where: { id }, data: { active: false, sessionVersion: { increment: 1 } } });
    await audit(tx, me, { action: "USER_DEACTIVATED", module: "Security", entityType: "User", entityId: id, message: `${me.name} deactivated ${target.name}.` });
  });
  revalidatePath("/users");
  revalidatePath(`/users/${id}`);
}

export async function reactivateUserAction(id: string) {
  const me = await requirePermission("users.manage");
  const target = await prisma.user.findUniqueOrThrow({ where: { id } });
  if (escalationError(me, target.role)) redirect("/no-access?need=admin");
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { active: true } });
    await audit(tx, me, { action: "USER_REACTIVATED", module: "Security", entityType: "User", entityId: id, message: `${me.name} reactivated ${target.name}.` });
  });
  revalidatePath("/users");
  revalidatePath(`/users/${id}`);
}

// A true delete only succeeds when the account has authored/approved
// nothing at all -- most of those relations restrict deletion at the
// database level on purpose, to protect the audit trail. Deactivate is
// the normal way to offboard a user who has done anything in the system.
export async function deleteUserAction(id: string, _prevState: { error: string | null }): Promise<{ error: string | null }> {
  const me = await requirePermission("users.manage");
  if (me.id === id) return { error: "You cannot delete your own account." };
  const target = await prisma.user.findUniqueOrThrow({ where: { id } });
  const esc = escalationError(me, target.role);
  if (esc) return { error: esc };

  try {
    await prisma.user.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return {
        error: "This user has linked records (requests, approvals, uploads, ...) and can't be deleted -- deactivate them instead.",
      };
    }
    throw error;
  }
  await audit(prisma, me, { action: "USER_DELETED", module: "Security", entityType: "User", entityId: id, message: `${me.name} deleted the unused account of ${target.name} (${target.email}).` });

  revalidatePath("/users");
  redirect("/users");
}
