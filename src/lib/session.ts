import { cache } from "react";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { isFullAccessRole } from "@/lib/roles";
import { canAccessJob, grantFor, hasPermission, type Grant, type Permission } from "@/lib/permission-catalog";
import { sessionExpired } from "@/lib/security-rules";
import { getSettings } from "@/lib/settings";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  ministryId: string | null;
  vendorClientId: string | null;
  grant: Grant;
  profileName: string | null;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
};

/**
 * The signed-in user, re-checked against the database on every request:
 * a deactivated account, a password change / "sign out everywhere"
 * (sessionVersion), or a sign-in older than the configured session length
 * all end the session. Permissions are read fresh, so role changes apply
 * immediately.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const [user, settings] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, include: { accessProfile: true } }),
    getSettings(),
  ]);
  if (!user || !user.active) return null;
  if ((session.user.sessionVersion ?? 0) !== user.sessionVersion) return null;
  if (sessionExpired(session.user.loginAt, settings.sessionHours)) return null;
  const p = user.accessProfile;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    ministryId: user.ministryId,
    vendorClientId: user.vendorClientId,
    grant: grantFor(
      user.role,
      p ? { permissions: p.permissions, jobCategories: p.jobCategories, assignedJobsOnly: p.assignedJobsOnly, approvalLimit: p.approvalLimit === null ? null : Number(p.approvalLimit) } : null,
    ),
    profileName: isFullAccessRole(user.role) ? "Super Admin" : (p?.name ?? (user.role === "STAFF" ? "Staff" : null)),
    mustChangePassword: user.mustChangePassword,
    mfaEnabled: !!user.mfaEnabledAt,
  };
});

/** Any signed-in user with a valid session; otherwise back to the sign-in page. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?ended=1");
  return user;
}

// Permissions that approve or move money / manage access. When Settings →
// "require two-factor for managers" is on, they only work with MFA turned on.
export const MFA_GUARDED: Permission[] = ["expenses.approve", "payments.authorize", "finance.banking", "finance.journal", "finance.refunds", "users.manage", "settings.manage"];

/** Server-side permission check for pages and actions (the UI is never trusted). */
export async function requirePermission(...anyOf: Permission[]) {
  const user = await requireUser();
  const held = anyOf.filter((p) => hasPermission(user.grant, p));
  if (held.length === 0) redirect(`/no-access?need=${anyOf.join(",")}`);
  if (!user.mfaEnabled && held.every((p) => MFA_GUARDED.includes(p)) && (await getSettings()).requireMfaForManagers) {
    redirect("/account?mfa=required");
  }
  return user;
}

export async function can(permission: Permission) {
  const user = await getCurrentUser();
  return !!user && hasPermission(user.grant, permission);
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!isFullAccessRole(user.role)) redirect("/no-access?need=admin");
  return user;
}

// ADMIN/SUPERVISOR always pass every role check below, per spec.
export async function requireRole(...roles: Role[]) {
  const user = await requireUser();
  if (!isFullAccessRole(user.role) && !roles.includes(user.role)) redirect("/no-access");
  return user;
}

// Internal operations staff (the service/job/finance side of the app).
export async function requireStaff() {
  return requireRole("STAFF");
}

/** Prisma filter for the jobs this user may see (service lines / assigned only). */
export function jobScopeWhere(user: CurrentUser): Prisma.JobWhereInput {
  const g = user.grant;
  if (g.fullAccess) return {};
  const and: Prisma.JobWhereInput[] = [];
  if (g.jobCategories.length > 0) and.push({ service: { category: { in: g.jobCategories } } });
  if (g.assignedJobsOnly) and.push({ OR: [{ responsibleId: user.id }, { tasks: { some: { assigneeId: user.id } } }] });
  if (!g.permissions.includes("jobs.view")) and.push({ id: "__none__" });
  return and.length ? { AND: and } : {};
}

/** A job action: the permission, plus the job must be within the user's scope. */
export async function requireJobAccess(jobId: string, ...anyOf: Permission[]) {
  const user = anyOf.length ? await requirePermission(...anyOf) : await requirePermission("jobs.view");
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { responsibleId: true, service: { select: { category: true } }, tasks: { select: { assigneeId: true } } },
  });
  if (!job) redirect("/jobs");
  const ok = canAccessJob(user.grant, user.id, {
    category: job.service.category,
    responsibleId: job.responsibleId,
    taskAssigneeIds: job.tasks.map((t) => t.assigneeId).filter((x): x is string => !!x),
  });
  if (!ok) redirect("/no-access?need=job");
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
