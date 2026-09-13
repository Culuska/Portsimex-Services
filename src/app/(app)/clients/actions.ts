"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const clientStages = ["PROSPECT", "ACTIVE", "DORMANT", "LOST"] as const;

const clientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  stage: z.enum(clientStages).optional(),
});

function parseClientForm(formData: FormData) {
  return clientSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    notes: formData.get("notes"),
    stage: formData.get("stage") || undefined,
  });
}

export async function createClientAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  await requireUser();
  const parsed = parseClientForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const client = await prisma.client.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      notes: parsed.data.notes || null,
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
  await requireUser();
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
  const user = await requireUser();
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
  await requireUser();
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
  await requireUser();
  const done = formData.get("done") === "true";
  await prisma.clientFollowUp.update({
    where: { id: followUpId },
    data: { done: !done },
  });
  revalidatePath(`/clients/${clientId}`);
}
