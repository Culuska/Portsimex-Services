"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireMinistryRegistrar } from "@/lib/session";

const SHIPMENT_TYPES = ["IMPORT", "EXPORT", "TRANSSHIPMENT", "DOMESTIC"] as const;

const ministrySchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required"),
  description: z.string().optional().or(z.literal("")),
  active: z.coerce.boolean().optional(),
  defaultPosition: z.coerce.number().int().positive().optional(),
  requiredDocumentTypes: z.string().optional().or(z.literal("")),
});

function parseDocTypes(raw: string | undefined) {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createMinistryAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  await requireMinistryRegistrar();

  const parsed = ministrySchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    description: formData.get("description"),
    active: formData.get("active") === "on",
    defaultPosition: formData.get("defaultPosition") || undefined,
    requiredDocumentTypes: formData.get("requiredDocumentTypes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const existing = await prisma.ministry.findUnique({ where: { code: parsed.data.code } });
  if (existing) {
    return { error: "A ministry with that code already exists." };
  }

  const ministry = await prisma.ministry.create({
    data: {
      name: parsed.data.name,
      code: parsed.data.code,
      description: parsed.data.description || null,
      active: parsed.data.active ?? true,
      defaultPosition: parsed.data.defaultPosition ?? null,
      requiredDocumentTypes: parseDocTypes(parsed.data.requiredDocumentTypes),
    },
  });

  revalidatePath("/ministries");
  redirect(`/ministries/${ministry.id}`);
}

export async function updateMinistryAction(
  id: string,
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  await requireMinistryRegistrar();

  const parsed = ministrySchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    description: formData.get("description"),
    active: formData.get("active") === "on",
    defaultPosition: formData.get("defaultPosition") || undefined,
    requiredDocumentTypes: formData.get("requiredDocumentTypes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.ministry.update({
    where: { id },
    data: {
      name: parsed.data.name,
      code: parsed.data.code,
      description: parsed.data.description || null,
      active: parsed.data.active ?? false,
      defaultPosition: parsed.data.defaultPosition ?? null,
      requiredDocumentTypes: parseDocTypes(parsed.data.requiredDocumentTypes),
    },
  });

  revalidatePath("/ministries");
  revalidatePath(`/ministries/${id}`);
  return { error: null };
}

const chainSchema = z.object({
  shipmentType: z.enum(SHIPMENT_TYPES),
  ministryIds: z.array(z.string()),
});

// Replaces the entire ordered chain for one shipment type. Position is
// simply the array order the admin screen submits.
export async function saveChainAction(formData: FormData) {
  await requireMinistryRegistrar();

  const parsed = chainSchema.safeParse({
    shipmentType: formData.get("shipmentType"),
    ministryIds: formData.getAll("ministryIds[]"),
  });
  if (!parsed.success) return;

  await prisma.$transaction([
    prisma.ministryChainStep.deleteMany({
      where: { shipmentType: parsed.data.shipmentType },
    }),
    ...parsed.data.ministryIds.map((ministryId, index) =>
      prisma.ministryChainStep.create({
        data: {
          shipmentType: parsed.data.shipmentType,
          ministryId,
          position: index + 1,
        },
      }),
    ),
  ]);

  revalidatePath("/ministries/chains");
}
