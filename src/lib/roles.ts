export const ROLES = [
  "ADMIN",
  "SUPERVISOR",
  "STAFF",
  "MINISTRY_REGISTRAR",
  "MINISTRY_OFFICER",
  "VENDOR",
  "LOGISTICS_STAFF",
] as const;

export type Role = (typeof ROLES)[number];

// ADMIN and SUPERVISOR are both unrestricted "super" roles with identical
// permissions everywhere in the app -- SUPERVISOR exists purely as a
// second label for organizations that use both titles. Every access
// check that used to compare against "ADMIN" alone now goes through
// this, so the two roles can never drift out of sync.
export function isFullAccessRole(role: string): boolean {
  return role === "ADMIN" || role === "SUPERVISOR";
}
