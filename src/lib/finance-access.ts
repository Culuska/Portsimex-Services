import { auth } from "@/auth";
import { isFullAccessRole } from "@/lib/roles";

/** Finance pages: managers see everything; operations staff see the day-to-day money screens only. */
export async function financeViewer() {
  const session = await auth();
  const role = session?.user?.role;
  return {
    session,
    isManager: !!role && isFullAccessRole(role),
    isStaff: !!role && (isFullAccessRole(role) || role === "STAFF"),
  };
}
