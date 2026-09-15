export const ROLES = [
  "ADMIN",
  "STAFF",
  "MINISTRY_REGISTRAR",
  "MINISTRY_OFFICER",
  "VENDOR",
  "LOGISTICS_STAFF",
] as const;

export type Role = (typeof ROLES)[number];
