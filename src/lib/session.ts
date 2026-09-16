import { auth } from "@/auth";
import type { Role } from "@/lib/roles";
import { isFullAccessRole } from "@/lib/roles";

export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Not authenticated");
  }
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!isFullAccessRole(user.role)) {
    throw new Error("Admin access required");
  }
  return user;
}

// ADMIN/SUPERVISOR always pass every role check below, per spec.
export async function requireRole(...roles: Role[]) {
  const user = await requireUser();
  if (!isFullAccessRole(user.role) && !roles.includes(user.role)) {
    throw new Error(`Requires one of: ${roles.join(", ")}`);
  }
  return user;
}

export async function requireMinistryRegistrar() {
  return requireRole("MINISTRY_REGISTRAR");
}

// Returns the user with ministryId guaranteed non-null (ADMIN/SUPERVISOR
// callers must pass a ministryId explicitly wherever this matters, since
// they have none).
export async function requireMinistryOfficer(ministryId?: string) {
  const user = await requireRole("MINISTRY_OFFICER");
  const effectiveMinistryId = isFullAccessRole(user.role) ? ministryId : user.ministryId;
  if (!effectiveMinistryId) {
    throw new Error("No ministry scope for this user");
  }
  return { ...user, ministryId: effectiveMinistryId };
}

export async function requireVendor(vendorClientId?: string) {
  const user = await requireRole("VENDOR");
  const effectiveClientId = isFullAccessRole(user.role) ? vendorClientId : user.vendorClientId;
  if (!effectiveClientId) {
    throw new Error("No vendor client scope for this user");
  }
  return { ...user, vendorClientId: effectiveClientId };
}

export async function requireLogisticsStaff() {
  return requireRole("LOGISTICS_STAFF");
}
