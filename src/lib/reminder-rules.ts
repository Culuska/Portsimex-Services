// When automatic reminders and expiry alerts fire. Pure module (unit tested).

export const EXPIRY_ALERT_DAYS = [30, 7, 0] as const;
export type ExpiryThreshold = (typeof EXPIRY_ALERT_DAYS)[number];

function dayStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Whole days from today until `date` (negative once past). */
export function daysUntil(date: Date, now = new Date()): number {
  return Math.round((dayStart(date) - dayStart(now)) / 86_400_000);
}

/**
 * The alert threshold an expiry date has reached: 30 days, 7 days, or 0
 * (expired / expires today). Each threshold alerts once, so a document
 * produces at most three reminders over its life.
 */
export function expiryThreshold(date: Date, now = new Date()): ExpiryThreshold | null {
  const left = daysUntil(date, now);
  if (left <= 0) return 0;
  if (left <= 7) return 7;
  if (left <= 30) return 30;
  return null;
}

export type ExpiryState = "EXPIRED" | "EXPIRES_SOON" | "UPCOMING" | "VALID";

export function expiryState(date: Date, now = new Date()): ExpiryState {
  const left = daysUntil(date, now);
  if (left < 0) return "EXPIRED";
  if (left <= 30) return "EXPIRES_SOON";
  if (left <= 60) return "UPCOMING";
  return "VALID";
}

/** Service-specific date fields that hold an expiry (passportExpiry, documentExpiry, expiryDate...). */
export function isExpiryField(field: { key: string; type: string }): boolean {
  return field.type === "date" && /expir/i.test(field.key);
}

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
