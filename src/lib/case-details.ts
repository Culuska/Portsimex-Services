// Keeps a case's service fields in step with what was recorded elsewhere
// (submission date, ministry, approval date, certificate number, expiry),
// filling only fields the service actually has and that are still empty --
// never overwriting what a user typed.
import { parseFields } from "@/lib/service-templates";

export function fillEmptyDetails(
  details: Record<string, unknown>,
  serviceFields: unknown,
  candidates: Record<string, string | number | null | undefined>,
): Record<string, unknown> | null {
  const keys = new Set(parseFields(serviceFields).map((f) => f.key));
  const next = { ...details };
  let changed = false;
  for (const [key, value] of Object.entries(candidates)) {
    if (value === null || value === undefined || value === "") continue;
    if (!keys.has(key)) continue;
    if (next[key] !== null && next[key] !== undefined && next[key] !== "") continue;
    next[key] = value;
    changed = true;
  }
  return changed ? next : null;
}

export function dateValue(d: Date | null | undefined): string | null {
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
