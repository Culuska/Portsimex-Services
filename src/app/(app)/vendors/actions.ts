"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const vendorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  service: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

function parseVendorForm(formData: FormData) {
  return vendorSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    service: formData.get("service"),
    notes: formData.get("notes"),
  });
}

export async function createVendorAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  await requireUser();
  const parsed = parseVendorForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const vendor = await prisma.vendor.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      service: parsed.data.service || null,
      notes: parsed.data.notes || null,
    },
  });

  revalidatePath("/vendors");
  redirect(`/vendors/${vendor.id}`);
}

export async function updateVendorAction(
  id: string,
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  await requireUser();
  const parsed = parseVendorForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.vendor.update({
    where: { id },
    data: {
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      service: parsed.data.service || null,
      notes: parsed.data.notes || null,
    },
  });

  revalidatePath("/vendors");
  revalidatePath(`/vendors/${id}`);
  return { error: null };
}
