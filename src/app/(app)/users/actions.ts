"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { ROLES } from "@/lib/roles";

const userSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(ROLES),
  ministryId: z.string().optional().or(z.literal("")),
  vendorClientId: z.string().optional().or(z.literal("")),
});

function assertScopeForRole(data: { role: string; ministryId?: string; vendorClientId?: string }) {
  if (
    (data.role === "MINISTRY_OFFICER" || data.role === "MINISTRY_REGISTRAR") &&
    !data.ministryId
  ) {
    return "Select a ministry for this role";
  }
  if (data.role === "VENDOR" && !data.vendorClientId) {
    return "Select a vendor company for this role";
  }
  return null;
}

export async function createUserAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  await requireAdmin();

  const parsed = userSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
    ministryId: formData.get("ministryId"),
    vendorClientId: formData.get("vendorClientId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const scopeError = assertScopeForRole(parsed.data);
  if (scopeError) return { error: scopeError };

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (existing) {
    return { error: "A user with that email already exists." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      passwordHash,
      role: parsed.data.role,
      ministryId: parsed.data.ministryId || null,
      vendorClientId: parsed.data.vendorClientId || null,
    },
  });

  revalidatePath("/users");
  redirect("/users");
}

// Password is optional on edit -- leaving it blank keeps the current one.
const updateUserSchema = userSchema.extend({
  password: z.string().min(8, "Password must be at least 8 characters").optional().or(z.literal("")),
});

export async function updateUserAction(
  id: string,
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  await requireAdmin();

  const parsed = updateUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
    ministryId: formData.get("ministryId"),
    vendorClientId: formData.get("vendorClientId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const scopeError = assertScopeForRole(parsed.data);
  if (scopeError) return { error: scopeError };

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (existing && existing.id !== id) {
    return { error: "A user with that email already exists." };
  }

  await prisma.user.update({
    where: { id },
    data: {
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      role: parsed.data.role,
      ministryId: parsed.data.ministryId || null,
      vendorClientId: parsed.data.vendorClientId || null,
      ...(parsed.data.password ? { passwordHash: await bcrypt.hash(parsed.data.password, 10) } : {}),
    },
  });

  revalidatePath("/users");
  revalidatePath(`/users/${id}`);
  return { error: null };
}

export async function deactivateUserAction(id: string) {
  const admin = await requireAdmin();
  if (admin.id === id) {
    throw new Error("You cannot deactivate your own account.");
  }
  await prisma.user.update({ where: { id }, data: { active: false } });
  revalidatePath("/users");
  revalidatePath(`/users/${id}`);
}

export async function reactivateUserAction(id: string) {
  await requireAdmin();
  await prisma.user.update({ where: { id }, data: { active: true } });
  revalidatePath("/users");
  revalidatePath(`/users/${id}`);
}

// A true delete only succeeds when the account has authored/approved
// nothing at all -- most of those relations restrict deletion at the
// database level on purpose, to protect the audit trail. Deactivate is
// the normal way to offboard a user who has done anything in the system.
export async function deleteUserAction(
  id: string,
  _prevState: { error: string | null },
): Promise<{ error: string | null }> {
  const admin = await requireAdmin();
  if (admin.id === id) {
    return { error: "You cannot delete your own account." };
  }

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

  revalidatePath("/users");
  redirect("/users");
}
