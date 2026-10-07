import { requirePermission } from "@/lib/session";
import { hasPermission, type Grant, type Permission } from "@/lib/permission-catalog";
import { REPORTS, type ReportKey } from "@/lib/finance-reports";

/** Finance pages: the page's permission, plus helpers to show only what this user may do. */
export async function financeViewer(...anyOf: Permission[]) {
  const me = await requirePermission(...anyOf);
  const can = (p: Permission) => hasPermission(me.grant, p);
  return { me, can };
}

export function canSeeReport(grant: Grant, key: ReportKey) {
  return REPORTS[key].permissions.some((p) => hasPermission(grant, p));
}
