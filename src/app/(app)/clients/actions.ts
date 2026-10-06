"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { SERVICE_TYPES, RATE_BASED_SERVICE_TYPES, AGREEMENT_TYPES } from "@/lib/services";
import { deriveMnemonicBase, resolveMnemonicCollision } from "@/lib/client-mnemonic";

const clientStages = ["PROSPECT", "ACTIVE", "DORMANT", "LOST"] as const;
const clientTypes = ["CORPORATE", "NGO", "INTERNATIONAL_ORGANIZATION", "GOVERNMENT_RELATED", "INDIVIDUAL", "OTHER"] as const;
const optionalNonNeg = z.union([z.literal(""), z.coerce.number().min(0, "Amounts can't be negative")]);

const clientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  stage: z.enum(clientStages).optional(),
  agreementType: z.enum(AGREEMENT_TYPES).optional().or(z.literal("")),
  services: z.array(z.enum(SERVICE_TYPES)),
  clientType: z.enum(clientTypes),
  contactPerson: z.string().trim(),
  department: z.string().trim(),
  country: z.string().trim(),
  taxNumber: z.string().trim(),
  paymentTermsDays: z.union([z.literal(""), z.coerce.number().int().min(0, "Payment terms can't be negative").max(365)]),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Currency must be a 3-letter code, e.g. USD"),
  creditLimit: optionalNonNeg,
});

function parseClientForm(formData: FormData) {
  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    notes: formData.get("notes"),
    stage: formData.get("stage") || undefined,
    agreementType: formData.get("agreementType") || undefined,
    services: formData.getAll("services"),
    clientType: formData.get("clientType") ?? "CORPORATE",
    contactPerson: formData.get("contactPerson") ?? "",
    department: formData.get("department") ?? "",
    country: formData.get("country") ?? "",
    taxNumber: formData.get("taxNumber") ?? "",
    paymentTermsDays: formData.get("paymentTermsDays") ?? "",
    currency: formData.get("currency") || "USD",
    creditLimit: formData.get("creditLimit") ?? "",
  });
  if (!parsed.success) return parsed;

  const serviceRates: { serviceType: (typeof SERVICE_TYPES)[number]; markupPercent: number }[] =
    [];
  for (const service of parsed.data.services) {
    if (!(RATE_BASED_SERVICE_TYPES as readonly string[]).includes(service)) continue;
    const rate = Number(formData.get(`rate_${service}`));
    if (!Number.isFinite(rate) || rate < 0) {
      return {
        success: false as const,
        error: {
          issues: [{ message: `Enter an agreed rate for ${service.replace(/_/g, " ")}` }],
        },
      };
    }
    serviceRates.push({ serviceType: service, markupPercent: rate });
  }

  return { success: true as const, data: { ...parsed.data, serviceRates } };
}

export async function createClientAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  await requireStaff();
  const parsed = parseClientForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Immutable, generated once here -- editing the client later never
  // touches it (see updateClientAction below).
  const existingMnemonics = await prisma.client.findMany({ select: { mnemonic: true } });
  const mnemonic = resolveMnemonicCollision(
    deriveMnemonicBase(parsed.data.name),
    new Set(existingMnemonics.map((c) => c.mnemonic)),
  );

  const client = await prisma.client.create({
    data: {
      name: parsed.data.name,
      mnemonic,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      notes: parsed.data.notes || null,
      agreementType: parsed.data.agreementType || null,
      services: parsed.data.services,
      clientType: parsed.data.clientType,
      contactPerson: parsed.data.contactPerson || null,
      department: parsed.data.department || null,
      country: parsed.data.country || null,
      taxNumber: parsed.data.taxNumber || null,
      paymentTermsDays: parsed.data.paymentTermsDays === "" ? null : parsed.data.paymentTermsDays,
      currency: parsed.data.currency,
      creditLimit: parsed.data.creditLimit === "" ? null : parsed.data.creditLimit,
      serviceRates: { create: parsed.data.serviceRates },
    },
  });

  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}

export async function updateClientAction(
  id: string,
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  await requireStaff();
  const parsed = parseClientForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.client.update({
    where: { id },
    data: {
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      notes: parsed.data.notes || null,
      stage: parsed.data.stage,
      agreementType: parsed.data.agreementType || null,
      services: parsed.data.services,
      clientType: parsed.data.clientType,
      contactPerson: parsed.data.contactPerson || null,
      department: parsed.data.department || null,
      country: parsed.data.country || null,
      taxNumber: parsed.data.taxNumber || null,
      paymentTermsDays: parsed.data.paymentTermsDays === "" ? null : parsed.data.paymentTermsDays,
      currency: parsed.data.currency,
      creditLimit: parsed.data.creditLimit === "" ? null : parsed.data.creditLimit,
      serviceRates: { deleteMany: {}, create: parsed.data.serviceRates },
    },
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { error: null };
}

const noteSchema = z.object({
  body: z.string().min(1, "Note can't be empty"),
});

export async function addClientNoteAction(
  clientId: string,
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const user = await requireStaff();
  const parsed = noteSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.clientNote.create({
    data: {
      clientId,
      body: parsed.data.body,
      authorId: user.id,
    },
  });

  revalidatePath(`/clients/${clientId}`);
  return { error: null };
}

const followUpSchema = z.object({
  dueDate: z.string().min(1, "Due date is required"),
  note: z.string().min(1, "Note is required"),
});

export async function addFollowUpAction(
  clientId: string,
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  await requireStaff();
  const parsed = followUpSchema.safeParse({
    dueDate: formData.get("dueDate"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.clientFollowUp.create({
    data: {
      clientId,
      dueDate: new Date(parsed.data.dueDate),
      note: parsed.data.note,
    },
  });

  revalidatePath(`/clients/${clientId}`);
  return { error: null };
}

export async function toggleFollowUpAction(
  followUpId: string,
  clientId: string,
  formData: FormData,
) {
  await requireStaff();
  const done = formData.get("done") === "true";
  await prisma.clientFollowUp.update({
    where: { id: followUpId },
    data: { done: !done },
  });
  revalidatePath(`/clients/${clientId}`);
}
