"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

  if (
    (parsed.data.role === "MINISTRY_OFFICER" || parsed.data.role === "MINISTRY_REGISTRAR") &&
    !parsed.data.ministryId
  ) {
    return { error: "Select a ministry for this role" };
  }
  if (parsed.data.role === "VENDOR" && !parsed.data.vendorClientId) {
    return { error: "Select a vendor company for this role" };
  }

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
