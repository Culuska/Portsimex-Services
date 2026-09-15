import type { Role } from "@/lib/roles";

// ADMIN (SuperAdmin) always has full access, per spec.
export function canManageMinistries(role: Role): boolean {
  return role === "ADMIN" || role === "MINISTRY_REGISTRAR";
}

export function canActAsMinistryOfficer(role: Role): boolean {
  return role === "ADMIN" || role === "MINISTRY_OFFICER";
}

export function canAccessVendorPortal(role: Role): boolean {
  return role === "ADMIN" || role === "VENDOR";
}

export function canCreateDeliveryRecord(role: Role): boolean {
  return role === "ADMIN" || role === "LOGISTICS_STAFF";
}

// A vendor may only ever see shipments for their own client -- never
// another vendor's. ADMIN can see any shipment.
export function canViewVendorShipment(
  actor: { role: Role; vendorClientId: string | null },
  shipmentClientId: string,
): boolean {
  if (actor.role === "ADMIN") return true;
  if (actor.role !== "VENDOR") return false;
  return actor.vendorClientId === shipmentClientId;
}

// A ministry officer may only act on steps at their own ministry.
export function canActOnMinistryStep(
  actor: { role: Role; ministryId: string | null },
  stepMinistryId: string,
): boolean {
  if (actor.role === "ADMIN") return true;
  if (actor.role !== "MINISTRY_OFFICER") return false;
  return actor.ministryId === stepMinistryId;
}
