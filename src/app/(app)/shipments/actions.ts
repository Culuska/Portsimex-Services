"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/session";

const shipmentTypes = ["IMPORT", "EXPORT", "TRANSSHIPMENT", "DOMESTIC", "CUSTOMS_CLEARANCE"] as const;
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

// A shipment only exists once a client has accepted a quote -- it is not
// a standalone record you create up front. Its tracking reference is the
// accepted quote's own number (e.g. QT-2026-0007), never a separately
// generated one, so the same identifier follows the job from quotation
// through to delivery.
const createSchema = shipmentSchema.extend({
  quoteId: z.string().min(1, "An accepted quote is required to start a shipment"),
});

// Operations lead (ADMIN) approval gate: a client accepting a quote is
// not enough on its own to start the operational job -- only an admin can
// actually commit to it becoming a shipment.
export async function createShipmentAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  await requireAdmin();
  const parsed = createSchema.safeParse({
    ...readShipmentForm(formData),
    quoteId: formData.get("quoteId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const quote = await prisma.quote.findUnique({ where: { id: parsed.data.quoteId } });
  if (!quote || quote.status !== "ACCEPTED") {
    return { error: "This quote is no longer available to start a shipment from." };
  }
  if (quote.shipmentId) {
    return { error: "This quote already has a shipment." };
  }
  if (quote.clientId !== parsed.data.clientId) {
    return { error: "Client does not match the quote." };
  }
  if (quote.type !== parsed.data.type) {
    return { error: "Job type does not match the quote." };
  }

  let shipmentId: string;
  try {
    const shipment = await prisma.$transaction(async (tx) => {
      const created = await tx.shipment.create({
        data: {
          reference: quote.quoteNumber,
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
      // Guards the same race the unique reference constraint would also
      // catch: only succeeds if this quote is still unclaimed.
      const linked = await tx.quote.updateMany({
        where: { id: quote.id, shipmentId: null },
        data: { shipmentId: created.id },
      });
      if (linked.count === 0) {
        throw new Error("This quote already has a shipment.");
      }
      return created;
    });
    shipmentId = shipment.id;
  } catch {
    return { error: "This quote already has a shipment." };
  }

  revalidatePath("/shipments");
  revalidatePath(`/quotes/${quote.id}`);
  redirect(`/shipments/${shipmentId}`);
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
