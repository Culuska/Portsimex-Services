import { describe, expect, it } from "vitest";
import type { Role } from "@/lib/roles";
import {
  canActAsMinistryOfficer,
  canActOnMinistryStep,
  canAccessVendorPortal,
  canCreateDeliveryRecord,
  canManageMinistries,
  canViewVendorShipment,
} from "./permissions";

const ALL_ROLES: Role[] = [
  "ADMIN",
  "SUPERVISOR",
  "STAFF",
  "MINISTRY_REGISTRAR",
  "MINISTRY_OFFICER",
  "VENDOR",
  "LOGISTICS_STAFF",
];

function rolesAllowed(check: (role: Role) => boolean): Role[] {
  return ALL_ROLES.filter(check);
}

describe("role -> screen authorization boundaries", () => {
  it("only ADMIN/SUPERVISOR and MINISTRY_REGISTRAR can manage the ministry registry", () => {
    expect(rolesAllowed(canManageMinistries).sort()).toEqual(
      ["ADMIN", "SUPERVISOR", "MINISTRY_REGISTRAR"].sort(),
    );
  });

  it("only ADMIN/SUPERVISOR and MINISTRY_OFFICER can act as a ministry officer", () => {
    expect(rolesAllowed(canActAsMinistryOfficer).sort()).toEqual(
      ["ADMIN", "SUPERVISOR", "MINISTRY_OFFICER"].sort(),
    );
  });

  it("only ADMIN/SUPERVISOR and VENDOR can access the vendor portal", () => {
    expect(rolesAllowed(canAccessVendorPortal).sort()).toEqual(
      ["ADMIN", "SUPERVISOR", "VENDOR"].sort(),
    );
  });

  it("only ADMIN/SUPERVISOR and LOGISTICS_STAFF can create a delivery record", () => {
    expect(rolesAllowed(canCreateDeliveryRecord).sort()).toEqual(
      ["ADMIN", "SUPERVISOR", "LOGISTICS_STAFF"].sort(),
    );
  });

  it("STAFF has none of the new module's elevated access", () => {
    expect(canManageMinistries("STAFF")).toBe(false);
    expect(canActAsMinistryOfficer("STAFF")).toBe(false);
    expect(canAccessVendorPortal("STAFF")).toBe(false);
    expect(canCreateDeliveryRecord("STAFF")).toBe(false);
  });
});

describe("canViewVendorShipment", () => {
  it("a vendor can view their own client's shipment", () => {
    expect(
      canViewVendorShipment({ role: "VENDOR", vendorClientId: "c1" }, "c1"),
    ).toBe(true);
  });

  it("a vendor cannot view another vendor's shipment", () => {
    expect(
      canViewVendorShipment({ role: "VENDOR", vendorClientId: "c1" }, "c2"),
    ).toBe(false);
  });

  it("admin can view any vendor's shipment", () => {
    expect(canViewVendorShipment({ role: "ADMIN", vendorClientId: null }, "c2")).toBe(
      true,
    );
  });

  it("supervisor can view any vendor's shipment", () => {
    expect(canViewVendorShipment({ role: "SUPERVISOR", vendorClientId: null }, "c2")).toBe(
      true,
    );
  });

  it("non-vendor, non-admin roles cannot view vendor shipments this way", () => {
    expect(
      canViewVendorShipment({ role: "MINISTRY_OFFICER", vendorClientId: null }, "c1"),
    ).toBe(false);
  });
});

describe("canActOnMinistryStep", () => {
  it("a ministry officer can act on their own ministry's step", () => {
    expect(
      canActOnMinistryStep({ role: "MINISTRY_OFFICER", ministryId: "m1" }, "m1"),
    ).toBe(true);
  });

  it("a ministry officer cannot act on another ministry's step (out of turn)", () => {
    expect(
      canActOnMinistryStep({ role: "MINISTRY_OFFICER", ministryId: "m1" }, "m2"),
    ).toBe(false);
  });

  it("admin can act on any ministry's step", () => {
    expect(canActOnMinistryStep({ role: "ADMIN", ministryId: null }, "m2")).toBe(true);
  });

  it("supervisor can act on any ministry's step", () => {
    expect(canActOnMinistryStep({ role: "SUPERVISOR", ministryId: null }, "m2")).toBe(true);
  });

  it("a vendor can never act on a ministry step", () => {
    expect(canActOnMinistryStep({ role: "VENDOR", ministryId: null }, "m1")).toBe(false);
  });
});
