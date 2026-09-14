export const SERVICE_TYPES = [
  "CUSTOMS_CLEARANCE",
  "IMPORT",
  "EXPORT",
  "IMMIGRATION_SUPPORT",
  "EXPEDITION",
  "TRANSPORTATION",
  "TOPUPS",
  "EMPLOYMENT_PAYMENT",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  CUSTOMS_CLEARANCE: "Customs Clearance",
  IMPORT: "Import",
  EXPORT: "Export",
  IMMIGRATION_SUPPORT: "Immigration Support",
  EXPEDITION: "Expedition",
  TRANSPORTATION: "Transportation",
  TOPUPS: "Topups",
  EMPLOYMENT_PAYMENT: "Employment Payment",
};

// Rate-based services are tied to a real market cost (a Purchase Request) and
// billed at cost + the client's agreed markup %. Flat services are quoted
// directly with no underlying purchase.
export const RATE_BASED_SERVICE_TYPES: readonly ServiceType[] = [
  "CUSTOMS_CLEARANCE",
  "IMPORT",
  "EXPORT",
  "EXPEDITION",
  "TRANSPORTATION",
];

export const FLAT_SERVICE_TYPES: readonly ServiceType[] = [
  "IMMIGRATION_SUPPORT",
  "TOPUPS",
  "EMPLOYMENT_PAYMENT",
];

export const AGREEMENT_TYPES = ["CLOSED", "NON_DISCLOSED"] as const;
export type AgreementType = (typeof AGREEMENT_TYPES)[number];

export const AGREEMENT_TYPE_LABELS: Record<AgreementType, string> = {
  CLOSED: "Closed Agreement",
  NON_DISCLOSED: "Non-Disclosed Agreement",
};
