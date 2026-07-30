"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const shipmentTypes = ["IMPORT", "EXPORT", "TRANSSHIPMENT", "DOMESTIC"] as const;
const shipmentStatuses = [
  "PENDING",
  "IN_TRANSIT",
  "ARRIVED",
  "CUSTOMS_HOLD",
  "COMPLETED",
  "CANCELLED",
] as const;

const shipmentSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  assigneeId: z.string().optional().or(z.literal("")),
  type: z.enum(shipmentTypes),
  origin: z.string().min(1, "Origin is required"),
  destination: z.string().min(1, "Destination is required"),
  cargoDescription: z.string().optional().or(z.literal("")),
  containerNumber: z.string().optional().or(z.literal("")),
  vessel: z.string().optional().or(z.literal("")),
  etd: z.string().optional().or(z.literal("")),
  eta: z.string().optional().or(z.literal("")),
});

function parseShipmentForm(formData: FormData) {
  return shipmentSchema.safeParse({
    clientId: formData.get("clientId"),
    assigneeId: formData.get("assigneeId"),
    type: formData.get("type"),
    origin: formData.get("origin"),
    destination: formData.get("destination"),
    cargoDescription: formData.get("cargoDescription"),
    containerNumber: formData.get("containerNumber"),
    vessel: formData.get("vessel"),
    etd: formData.get("etd"),
    eta: formData.get("eta"),
  });
}

async function generateReference() {
  const year = new Date().getFullYear();
  const count = await prisma.shipment.count();
  return `PSX-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function createShipmentAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  await requireUser();
  const parsed = parseShipmentForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const reference = await generateReference();

  const shipment = await prisma.shipment.create({
    data: {
      reference,
      clientId: parsed.data.clientId,
      assigneeId: parsed.data.assigneeId || null,
      type: parsed.data.type,
      origin: parsed.data.origin,
      destination: parsed.data.destination,
      cargoDescription: parsed.data.cargoDescription || null,
      containerNumber: parsed.data.containerNumber || null,
      vessel: parsed.data.vessel || null,
      etd: parsed.data.etd ? new Date(parsed.data.etd) : null,
      eta: parsed.data.eta ? new Date(parsed.data.eta) : null,
    },
  });

  revalidatePath("/shipments");
  redirect(`/shipments/${shipment.id}`);
}

const updateSchema = shipmentSchema.extend({
  status: z.enum(shipmentStatuses),
});

export async function updateShipmentAction(
  id: string,
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  await requireUser();
  const parsed = updateSchema.safeParse({
    clientId: formData.get("clientId"),
    assigneeId: formData.get("assigneeId"),
    type: formData.get("type"),
    status: formData.get("status"),
    origin: formData.get("origin"),
    destination: formData.get("destination"),
    cargoDescription: formData.get("cargoDescription"),
    containerNumber: formData.get("containerNumber"),
    vessel: formData.get("vessel"),
    etd: formData.get("etd"),
    eta: formData.get("eta"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.shipment.update({
    where: { id },
    data: {
      clientId: parsed.data.clientId,
      assigneeId: parsed.data.assigneeId || null,
      type: parsed.data.type,
      status: parsed.data.status,
      origin: parsed.data.origin,
      destination: parsed.data.destination,
      cargoDescription: parsed.data.cargoDescription || null,
      containerNumber: parsed.data.containerNumber || null,
      vessel: parsed.data.vessel || null,
      etd: parsed.data.etd ? new Date(parsed.data.etd) : null,
      eta: parsed.data.eta ? new Date(parsed.data.eta) : null,
    },
  });

  revalidatePath("/shipments");
  revalidatePath(`/shipments/${id}`);
  return { error: null };
}
