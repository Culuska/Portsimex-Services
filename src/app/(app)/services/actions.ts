"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { audit } from "@/lib/audit";
import { normalizePrefix } from "@/lib/document-numbers";
import {
  SERVICE_CATEGORIES,
  documentsFromLines,
  fieldsFromLines,
  stagesFromLines,
  tasksFromLines,
} from "@/lib/service-templates";

const serviceSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  code: z
    .string()
    .trim()
    .min(2, "Code is required")
    .transform((v) => v.toUpperCase().replace(/[^A-Z0-9_]/g, "_")),
  category: z.enum(SERVICE_CATEGORIES),
  jobPrefix: z.string().trim().min(1, "Job prefix is required").transform(normalizePrefix),
  description: z.string().optional(),
  slaDays: z.union([z.literal(""), z.coerce.number().int().min(0, "SLA days can't be negative")]),
  active: z.boolean(),
  reconcileQuantities: z.boolean(),
  stages: z.string(),
  documents: z.string(),
  tasks: z.string(),
  fields: z.string(),
});

export async function saveServiceAction(
  id: string | null,
  _prev: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const admin = await requirePermission("catalog.manage");
  const parsed = serviceSchema.safeParse({
    name: formData.get("name") ?? "",
    code: formData.get("code") ?? "",
    category: formData.get("category"),
    jobPrefix: formData.get("jobPrefix") ?? "",
    description: formData.get("description") || undefined,
    slaDays: formData.get("slaDays") ?? "",
    active: formData.get("active") === "on",
    reconcileQuantities: formData.get("reconcileQuantities") === "on",
    stages: formData.get("stages") ?? "",
    documents: formData.get("documents") ?? "",
    tasks: formData.get("tasks") ?? "",
    fields: formData.get("fields") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const d = parsed.data;
  const stages = stagesFromLines(d.stages);
  if (stages.length === 0) return { error: "Add at least one workflow stage." };

  const data = {
    name: d.name,
    code: d.code,
    category: d.category,
    jobPrefix: d.jobPrefix,
    description: d.description ?? null,
    slaDays: d.slaDays === "" ? null : d.slaDays,
    active: d.active,
    reconcileQuantities: d.reconcileQuantities,
    stages,
    documents: documentsFromLines(d.documents),
    tasks: tasksFromLines(d.tasks),
    fields: fieldsFromLines(d.fields),
  };

  const clash = await prisma.serviceDefinition.findUnique({ where: { code: d.code } });
  if (clash && clash.id !== id) return { error: `Code ${d.code} is already used by "${clash.name}".` };

  const saved = await prisma.$transaction(async (tx) => {
    const before = id ? await tx.serviceDefinition.findUniqueOrThrow({ where: { id } }) : null;
    const s = id ? await tx.serviceDefinition.update({ where: { id }, data }) : await tx.serviceDefinition.create({ data });
    await audit(tx, admin, {
      action: id ? "SERVICE_UPDATED" : "SERVICE_CREATED",
      module: "Service Catalog",
      entityType: "ServiceDefinition",
      entityId: s.id,
      reference: s.code,
      message: `${id ? "Updated" : "Added"} service "${s.name}"${before && before.active !== s.active ? (s.active ? " (reactivated)" : " (deactivated)") : ""}.`,
    });
    return s;
  });

  revalidatePath("/services");
  redirect(`/services/${saved.id}`);
}
