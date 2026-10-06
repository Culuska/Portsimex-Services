"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { audit } from "@/lib/audit";

const agencySchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  department: z.string().trim(),
  office: z.string().trim(),
  contactName: z.string().trim(),
  contactPhone: z.string().trim(),
  contactEmail: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
  location: z.string().trim(),
  services: z.string().trim(),
  referenceRequirements: z.string().trim(),
  notes: z.string().trim(),
  followUpDays: z.coerce.number().int().min(1, "Follow up at least every day").max(90),
  active: z.boolean(),
});

export async function saveAgencyAction(id: string | null, _prev: { error: string | null }, formData: FormData): Promise<{ error: string | null }> {
  const admin = await requireAdmin();
  const get = (k: string) => String(formData.get(k) ?? "");
  const parsed = agencySchema.safeParse({
    name: get("name"),
    department: get("department"),
    office: get("office"),
    contactName: get("contactName"),
    contactPhone: get("contactPhone"),
    contactEmail: get("contactEmail"),
    location: get("location"),
    services: get("services"),
    referenceRequirements: get("referenceRequirements"),
    notes: get("notes"),
    followUpDays: get("followUpDays") || "7",
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const d = parsed.data;
  const data = {
    name: d.name,
    department: d.department || null,
    office: d.office || null,
    contactName: d.contactName || null,
    contactPhone: d.contactPhone || null,
    contactEmail: d.contactEmail || null,
    location: d.location || null,
    services: d.services || null,
    referenceRequirements: d.referenceRequirements || null,
    notes: d.notes || null,
    followUpDays: d.followUpDays,
    active: d.active,
  };
  const saved = await prisma.$transaction(async (tx) => {
    const a = id ? await tx.governmentAgency.update({ where: { id }, data }) : await tx.governmentAgency.create({ data });
    await audit(tx, admin, {
      action: id ? "AGENCY_UPDATED" : "AGENCY_CREATED",
      module: "Government Agencies",
      entityType: "GovernmentAgency",
      entityId: a.id,
      message: `${id ? "Updated" : "Added"} agency "${a.name}".`,
    });
    return a;
  });
  revalidatePath("/agencies");
  redirect(`/agencies/${saved.id}`);
}
