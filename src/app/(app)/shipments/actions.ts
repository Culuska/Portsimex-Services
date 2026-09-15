"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const shipmentTypes = ["IMPORT", "EXPORT", "TRANSSHIPMENT", "DOMESTIC"] as const;
const transportModes = ["SEA", "AIR", "ROAD"] as const;
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
  transportMode: z.enum(transportModes),
  origin: z.string().min(1, "Origin is required"),
  destination: z.string().min(1, "Destination is required"),
  cargoDescription: z.string().optional().or(z.literal("")),
  etd: z.string().optional().or(z.literal("")),
  eta: z.string().optional().or(z.literal("")),
  // SEA
  containerNumber: z.string().optional().or(z.literal("")),
  vessel: z.string().optional().or(z.literal("")),
  billOfLading: z.string().optional().or(z.literal("")),
  // AIR
  airwayBill: z.string().optional().or(z.literal("")),
  flightCarrier: z.string().optional().or(z.literal("")),
  // ROAD
  vehicleType: z.string().optional().or(z.literal("")),
});

function readShipmentForm(formData: FormData) {
  return {
    clientId: formData.get("clientId"),
    assigneeId: formData.get("assigneeId"),
    type: formData.get("type"),
    transportMode: formData.get("transportMode"),
    origin: formData.get("origin"),
    destination: formData.get("destination"),
    cargoDescription: formData.get("cargoDescription"),
    etd: formData.get("etd"),
    eta: formData.get("eta"),
    containerNumber: formData.get("containerNumber"),
    vessel: formData.get("vessel"),
    billOfLading: formData.get("billOfLading"),
    airwayBill: formData.get("airwayBill"),
    flightCarrier: formData.get("flightCarrier"),
    vehicleType: formData.get("vehicleType"),
  };
}

// Only the fields for the selected transport mode are meaningful -- clear
// the others so switching SEA -> AIR on an existing shipment doesn't leave
// a stale vessel name sitting alongside a new airway bill number.
function modeScopedData(data: z.infer<typeof shipmentSchema>) {
  return {
    containerNumber: data.transportMode === "SEA" ? data.containerNumber || null : null,
    vessel: data.transportMode === "SEA" ? data.vessel || null : null,
    billOfLading: data.transportMode === "SEA" ? data.billOfLading || null : null,
    airwayBill: data.transportMode === "AIR" ? data.airwayBill || null : null,
    flightCarrier: data.transportMode === "AIR" ? data.flightCarrier || null : null,
    vehicleType: data.transportMode === "ROAD" ? data.vehicleType || null : null,
  };
}

function parseShipmentForm(formData: FormData) {
  return shipmentSchema.safeParse(readShipmentForm(formData));
}

// nextval() on a Postgres sequence is atomic, so concurrent shipment
// creation can never collide on the same tracking reference.
async function generateReference() {
  const year = new Date().getFullYear();
  const [{ nextval }] = await prisma.$queryRaw<{ nextval: bigint }[]>`
    SELECT nextval('shipment_reference_seq') AS nextval
  `;
  return `PSX-${year}-${String(nextval).padStart(4, "0")}`;
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
      transportMode: parsed.data.transportMode,
      origin: parsed.data.origin,
      destination: parsed.data.destination,
      cargoDescription: parsed.data.cargoDescription || null,
      etd: parsed.data.etd ? new Date(parsed.data.etd) : null,
      eta: parsed.data.eta ? new Date(parsed.data.eta) : null,
      ...modeScopedData(parsed.data),
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
    ...readShipmentForm(formData),
    status: formData.get("status"),
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
      transportMode: parsed.data.transportMode,
      status: parsed.data.status,
      origin: parsed.data.origin,
      destination: parsed.data.destination,
      cargoDescription: parsed.data.cargoDescription || null,
      etd: parsed.data.etd ? new Date(parsed.data.etd) : null,
      eta: parsed.data.eta ? new Date(parsed.data.eta) : null,
      ...modeScopedData(parsed.data),
    },
  });

  revalidatePath("/shipments");
  revalidatePath(`/shipments/${id}`);
  return { error: null };
}
