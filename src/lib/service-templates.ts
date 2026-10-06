// Service catalog templates: the shape of a service's workflow (stages,
// document checklist, tasks, service-specific fields). Stored as JSON on
// ServiceDefinition so admins can add services without a schema change,
// and copied onto each Job at creation so later template edits never
// rewrite jobs already in progress.
//
// Pure module (no app imports) so it can be unit tested directly.

export const SERVICE_CATEGORIES = [
  "LOGISTICS",
  "TRANSPORT",
  "GOVERNMENT_TAX",
  "VEHICLE",
  "IMMIGRATION",
  "COMMUNICATION",
  "OTHER",
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  LOGISTICS: "Logistics & Freight",
  TRANSPORT: "Transport",
  GOVERNMENT_TAX: "Government & Tax",
  VEHICLE: "Vehicle Services",
  IMMIGRATION: "Immigration Support",
  COMMUNICATION: "Communication Services",
  OTHER: "Other",
};

export const FIELD_TYPES = ["text", "number", "date", "select", "textarea"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export type StageTemplate = { name: string; requiresDocuments?: boolean };
export type DocumentTemplate = { name: string; required: boolean; isOutput?: boolean };
export type TaskTemplate = { title: string; dueOffsetDays?: number };
export type FieldTemplate = { key: string; label: string; type: FieldType; options?: string[] };

export type ServiceTemplate = {
  code: string;
  name: string;
  category: ServiceCategory;
  jobPrefix: string;
  description?: string;
  slaDays: number | null;
  stages: StageTemplate[];
  documents: DocumentTemplate[];
  tasks: TaskTemplate[];
  fields: FieldTemplate[];
  reconcileQuantities?: boolean;
};

// ---------------------------------------------------------------------------
// Parsing: JSON columns come back as `unknown` -- never trust their shape.
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export function parseStages(raw: unknown): StageTemplate[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!isRecord(item)) return [];
    const name = str(item.name);
    return name ? [{ name, requiresDocuments: item.requiresDocuments === true }] : [];
  });
}

export function parseDocuments(raw: unknown): DocumentTemplate[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!isRecord(item)) return [];
    const name = str(item.name);
    return name ? [{ name, required: item.required !== false, isOutput: item.isOutput === true }] : [];
  });
}

export function parseTasks(raw: unknown): TaskTemplate[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!isRecord(item)) return [];
    const title = str(item.title);
    if (!title) return [];
    const offset = typeof item.dueOffsetDays === "number" && item.dueOffsetDays >= 0 ? item.dueOffsetDays : undefined;
    return [{ title, dueOffsetDays: offset }];
  });
}

export function parseFields(raw: unknown): FieldTemplate[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.flatMap((item) => {
    if (!isRecord(item)) return [];
    const key = str(item.key);
    const label = str(item.label);
    const type = FIELD_TYPES.includes(item.type as FieldType) ? (item.type as FieldType) : "text";
    if (!key || !label || seen.has(key)) return [];
    seen.add(key);
    const options = Array.isArray(item.options) ? item.options.filter((o): o is string => typeof o === "string") : undefined;
    return [{ key, label, type, ...(type === "select" ? { options: options ?? [] } : {}) }];
  });
}

// Admin editor format: one item per line.
//   stages:    "Name"            or "Name | docs"   (docs = requires documents)
//   documents: "Name"            or "Name | optional" / "Name | output"
//   tasks:     "Title"           or "Title | 3"     (due 3 days after start)
//   fields:    "key | Label | type"  or "key | Label | select | A, B, C"
export function stagesFromLines(text: string): StageTemplate[] {
  return lines(text).map(([name, flag]) => ({ name, requiresDocuments: flag?.toLowerCase() === "docs" }));
}
export function documentsFromLines(text: string): DocumentTemplate[] {
  return lines(text).map(([name, flag]) => {
    const f = flag?.toLowerCase();
    return { name, required: f !== "optional", isOutput: f === "output" };
  });
}
export function tasksFromLines(text: string): TaskTemplate[] {
  return lines(text).map(([title, days]) => {
    const n = Number(days);
    return { title, dueOffsetDays: days && Number.isFinite(n) && n >= 0 ? n : undefined };
  });
}
export function fieldsFromLines(text: string): FieldTemplate[] {
  return parseFields(
    lines(text).map(([key, label, type, options]) => ({
      key: key.replace(/[^a-zA-Z0-9_]/g, ""),
      label: label ?? key,
      type: type?.toLowerCase(),
      options: options?.split(",").map((o) => o.trim()).filter(Boolean),
    })),
  );
}
function lines(text: string): string[][] {
  return text
    .split("\n")
    .map((l) => l.split("|").map((p) => p.trim()))
    .filter((parts) => parts[0] !== "");
}

export function stagesToLines(stages: StageTemplate[]): string {
  return stages.map((s) => (s.requiresDocuments ? `${s.name} | docs` : s.name)).join("\n");
}
export function documentsToLines(docs: DocumentTemplate[]): string {
  return docs.map((d) => (d.isOutput ? `${d.name} | output` : d.required ? d.name : `${d.name} | optional`)).join("\n");
}
export function tasksToLines(tasks: TaskTemplate[]): string {
  return tasks.map((t) => (t.dueOffsetDays !== undefined ? `${t.title} | ${t.dueOffsetDays}` : t.title)).join("\n");
}
export function fieldsToLines(fields: FieldTemplate[]): string {
  return fields
    .map((f) => [f.key, f.label, f.type, f.options?.join(", ")].filter((p) => p !== undefined && p !== "").join(" | "))
    .join("\n");
}

// ---------------------------------------------------------------------------
// Default catalog (seeded once into an empty service_definitions table)
// ---------------------------------------------------------------------------

type Family = Omit<ServiceTemplate, "code" | "name" | "category" | "jobPrefix" | "description">;

const IMPORT_LOGISTICS: Family = {
  slaDays: 21,
  stages: [
    { name: "Shipment information" },
    { name: "Document collection", requiresDocuments: true },
    { name: "Customs" },
    { name: "Tax / duty processing" },
    { name: "Port / handling" },
    { name: "Transport" },
    { name: "Delivery" },
    { name: "Proof of delivery" },
  ],
  documents: [
    { name: "Commercial invoice", required: true },
    { name: "Packing list", required: true },
    { name: "Bill of lading / AWB", required: true },
    { name: "Customs declaration", required: false },
    { name: "Proof of delivery (POD)", required: true, isOutput: true },
  ],
  tasks: [
    { title: "Collect shipping documents from client", dueOffsetDays: 2 },
    { title: "Lodge customs declaration", dueOffsetDays: 7 },
    { title: "Arrange port handling and release", dueOffsetDays: 12 },
    { title: "Arrange inland transport", dueOffsetDays: 14 },
    { title: "Obtain signed proof of delivery", dueOffsetDays: 21 },
  ],
  fields: [
    { key: "origin", label: "Origin", type: "text" },
    { key: "destination", label: "Destination", type: "text" },
    { key: "cargo", label: "Cargo description", type: "text" },
    { key: "weightKg", label: "Weight (kg)", type: "number" },
    { key: "volumeCbm", label: "Volume (CBM)", type: "number" },
    { key: "packages", label: "Packages", type: "number" },
    { key: "container", label: "Container number(s)", type: "text" },
    { key: "vesselFlight", label: "Vessel / flight", type: "text" },
    { key: "blAwb", label: "Bill of lading / AWB", type: "text" },
    { key: "customsRef", label: "Customs reference", type: "text" },
    { key: "etd", label: "ETD", type: "date" },
    { key: "eta", label: "ETA", type: "date" },
  ],
};

const EXPORT_LOGISTICS: Family = {
  slaDays: 14,
  stages: [
    { name: "Cargo details" },
    { name: "Export documents", requiresDocuments: true },
    { name: "Customs / declaration" },
    { name: "Transport" },
    { name: "Port / terminal" },
    { name: "Shipping" },
    { name: "Departure confirmation" },
  ],
  documents: [
    { name: "Commercial invoice", required: true },
    { name: "Packing list", required: true },
    { name: "Export permit / licence", required: false },
    { name: "Export declaration", required: true },
    { name: "Bill of lading / AWB (issued)", required: true, isOutput: true },
  ],
  tasks: [
    { title: "Confirm cargo details and booking", dueOffsetDays: 2 },
    { title: "Prepare export documents", dueOffsetDays: 5 },
    { title: "Lodge export declaration", dueOffsetDays: 7 },
    { title: "Deliver cargo to port / terminal", dueOffsetDays: 10 },
    { title: "Confirm departure and send documents to client", dueOffsetDays: 14 },
  ],
  fields: IMPORT_LOGISTICS.fields,
};

const TRANSPORT_TRIP: Family = {
  slaDays: 3,
  stages: [
    { name: "Planning" },
    { name: "Vehicle assignment" },
    { name: "Driver assignment" },
    { name: "Pre-trip check" },
    { name: "Dispatch" },
    { name: "In transit" },
    { name: "Delivery" },
    { name: "Proof of delivery", requiresDocuments: true },
    { name: "Cost reconciliation" },
  ],
  documents: [
    { name: "Delivery note / waybill", required: true },
    { name: "Pre-trip checklist", required: false },
    { name: "Signed proof of delivery (POD)", required: true, isOutput: true },
  ],
  tasks: [
    { title: "Plan route and schedule", dueOffsetDays: 0 },
    { title: "Assign vehicle and driver", dueOffsetDays: 0 },
    { title: "Complete pre-trip check", dueOffsetDays: 1 },
    { title: "Collect signed POD", dueOffsetDays: 3 },
    { title: "Reconcile fuel and trip costs", dueOffsetDays: 3 },
  ],
  fields: [
    { key: "origin", label: "Origin", type: "text" },
    { key: "destination", label: "Destination", type: "text" },
    { key: "cargo", label: "Cargo", type: "text" },
    { key: "vehicle", label: "Vehicle / plate", type: "text" },
    { key: "driver", label: "Driver", type: "text" },
    { key: "departure", label: "Departure date", type: "date" },
    { key: "arrival", label: "Arrival date", type: "date" },
    { key: "distanceKm", label: "Distance (km)", type: "number" },
    { key: "fuelLitres", label: "Fuel (litres)", type: "number" },
  ],
};

const GENERIC_LOGISTICS: Family = {
  slaDays: 7,
  stages: [
    { name: "Request review" },
    { name: "Document collection", requiresDocuments: true },
    { name: "Processing" },
    { name: "Completion confirmation" },
  ],
  documents: [
    { name: "Client instructions / documents", required: true },
    { name: "Completion document", required: true, isOutput: true },
  ],
  tasks: [
    { title: "Review request with client", dueOffsetDays: 1 },
    { title: "Collect required documents", dueOffsetDays: 2 },
    { title: "Complete service and confirm with client", dueOffsetDays: 7 },
  ],
  fields: [
    { key: "location", label: "Location / port", type: "text" },
    { key: "cargo", label: "Cargo", type: "text" },
    { key: "reference", label: "External reference", type: "text" },
  ],
};

const TAX_EXEMPTION: Family = {
  slaDays: 30,
  stages: [
    { name: "Document collection" },
    { name: "Document verification", requiresDocuments: true },
    { name: "Application preparation" },
    { name: "Client approval" },
    { name: "Ministry submission" },
    { name: "Ministry review" },
    { name: "Follow-up" },
    { name: "Approval / rejection" },
    { name: "Certificate collection" },
    { name: "Client delivery" },
  ],
  documents: [
    { name: "Client request letter", required: true },
    { name: "Supplier invoice", required: true },
    { name: "Purchase / import documents", required: true },
    { name: "Organization documentation", required: true },
    { name: "Government application", required: true },
    { name: "Supporting documents", required: false },
    { name: "Tax exemption certificate", required: true, isOutput: true },
  ],
  tasks: [
    { title: "Collect client documents", dueOffsetDays: 3 },
    { title: "Verify documents", dueOffsetDays: 5 },
    { title: "Prepare application", dueOffsetDays: 7 },
    { title: "Submit to ministry", dueOffsetDays: 10 },
    { title: "Follow up with ministry", dueOffsetDays: 17 },
    { title: "Collect certificate", dueOffsetDays: 28 },
    { title: "Deliver certificate to client", dueOffsetDays: 30 },
  ],
  fields: [
    { key: "organization", label: "Organization", type: "text" },
    { key: "purchaseDetails", label: "Purchase / import details", type: "textarea" },
    { key: "supplier", label: "Supplier", type: "text" },
    { key: "supplierInvoice", label: "Supplier invoice no.", type: "text" },
    { key: "taxType", label: "Tax type", type: "select", options: ["Customs duty", "Sales tax", "VAT", "Excise", "Other"] },
    { key: "estimatedTax", label: "Estimated tax amount", type: "number" },
    { key: "exemptionBasis", label: "Exemption basis / reference", type: "text" },
    { key: "ministry", label: "Required ministry", type: "text" },
    { key: "submissionDate", label: "Submission date", type: "date" },
    { key: "approvalDate", label: "Approval date", type: "date" },
    { key: "certificateNumber", label: "Certificate / reference no.", type: "text" },
    { key: "expiryDate", label: "Expiry date", type: "date" },
  ],
};

const GOVERNMENT_DOCS: Family = {
  slaDays: 14,
  stages: [
    { name: "Document collection" },
    { name: "Preparation", requiresDocuments: true },
    { name: "Submission" },
    { name: "Follow-up" },
    { name: "Response received" },
    { name: "Client delivery" },
  ],
  documents: [
    { name: "Client documents", required: true },
    { name: "Submission receipt", required: false },
    { name: "Official response / certificate", required: true, isOutput: true },
  ],
  tasks: [
    { title: "Collect and check client documents", dueOffsetDays: 2 },
    { title: "Prepare submission", dueOffsetDays: 4 },
    { title: "Submit to agency", dueOffsetDays: 5 },
    { title: "Follow up with agency", dueOffsetDays: 10 },
    { title: "Collect response and deliver to client", dueOffsetDays: 14 },
  ],
  fields: [
    { key: "agency", label: "Ministry / agency", type: "text" },
    { key: "office", label: "Department / office", type: "text" },
    { key: "submissionRef", label: "Submission reference", type: "text" },
    { key: "submissionDate", label: "Submission date", type: "date" },
    { key: "nextFollowUp", label: "Next follow-up date", type: "date" },
    { key: "responseDate", label: "Response date", type: "date" },
  ],
};

const VEHICLE_RENTAL: Family = {
  slaDays: 1,
  stages: [
    { name: "Quotation" },
    { name: "Client approval" },
    { name: "Vehicle assignment" },
    { name: "Contract", requiresDocuments: true },
    { name: "Vehicle handover" },
    { name: "Rental period" },
    { name: "Vehicle return" },
    { name: "Inspection" },
    { name: "Final charges" },
  ],
  documents: [
    { name: "Client ID / authorization", required: true },
    { name: "Signed rental contract", required: true },
    { name: "Handover checklist", required: true },
    { name: "Return inspection report", required: true, isOutput: true },
  ],
  tasks: [
    { title: "Send quotation", dueOffsetDays: 0 },
    { title: "Assign vehicle", dueOffsetDays: 0 },
    { title: "Sign rental contract", dueOffsetDays: 1 },
    { title: "Hand over vehicle", dueOffsetDays: 1 },
    { title: "Inspect vehicle on return", dueOffsetDays: 1 },
  ],
  fields: [
    { key: "vehicle", label: "Vehicle", type: "text" },
    { key: "plate", label: "Plate number", type: "text" },
    { key: "driver", label: "Driver (if provided)", type: "text" },
    { key: "rentalType", label: "Rental type", type: "select", options: ["Daily", "Weekly", "Monthly", "Long-term contract"] },
    { key: "startDate", label: "Start date", type: "date" },
    { key: "endDate", label: "End date", type: "date" },
    { key: "rate", label: "Rate", type: "number" },
    { key: "deposit", label: "Deposit", type: "number" },
    { key: "fuelPolicy", label: "Fuel policy", type: "select", options: ["Full to full", "Client pays fuel", "Fuel included"] },
    { key: "mileageOut", label: "Mileage out", type: "number" },
    { key: "mileageIn", label: "Mileage in", type: "number" },
    { key: "damageNotes", label: "Damage / additional charges", type: "textarea" },
  ],
};

const IMMIGRATION: Family = {
  slaDays: 30,
  stages: [
    { name: "Document checklist" },
    { name: "Documents received" },
    { name: "Verification", requiresDocuments: true },
    { name: "Application prepared" },
    { name: "Submitted" },
    { name: "Follow-up" },
    { name: "Decision / response" },
    { name: "Document received" },
    { name: "Client delivery" },
  ],
  documents: [
    { name: "Passport copy", required: true },
    { name: "Application form", required: true },
    { name: "Photographs", required: false },
    { name: "Supporting documents", required: true },
    { name: "Submission receipt", required: false },
    { name: "Final document (visa / permit)", required: true, isOutput: true },
  ],
  tasks: [
    { title: "Send document checklist to applicant", dueOffsetDays: 1 },
    { title: "Verify documents", dueOffsetDays: 5 },
    { title: "Prepare application", dueOffsetDays: 7 },
    { title: "Submit application", dueOffsetDays: 8 },
    { title: "Follow up with immigration office", dueOffsetDays: 18 },
    { title: "Deliver final document to client", dueOffsetDays: 30 },
  ],
  fields: [
    { key: "applicant", label: "Applicant name", type: "text" },
    { key: "nationality", label: "Nationality", type: "text" },
    { key: "passportNumber", label: "Passport number", type: "text" },
    { key: "passportExpiry", label: "Passport expiry", type: "date" },
    { key: "applicationType", label: "Application type", type: "select", options: ["Visa", "Work permit", "Residence permit", "Extension", "Other"] },
    { key: "office", label: "Immigration office", type: "text" },
    { key: "submissionDate", label: "Submission date", type: "date" },
    { key: "referenceNumber", label: "Reference number", type: "text" },
    { key: "documentExpiry", label: "Issued document expiry", type: "date" },
  ],
};

const COMMUNICATION_SINGLE: Family = {
  slaDays: 0,
  stages: [
    { name: "Request validation", requiresDocuments: true },
    { name: "Processing" },
    { name: "Provider confirmation" },
  ],
  documents: [
    { name: "Client authorization / ID", required: true },
    { name: "Provider confirmation", required: true, isOutput: true },
  ],
  tasks: [
    { title: "Validate request and documents", dueOffsetDays: 0 },
    { title: "Process with operator", dueOffsetDays: 0 },
  ],
  fields: [
    { key: "operator", label: "Operator / provider", type: "text" },
    { key: "simReference", label: "SIM / account reference", type: "text" },
    { key: "quantity", label: "Quantity", type: "number" },
    { key: "providerReference", label: "Provider reference", type: "text" },
  ],
};

const COMMUNICATION_BULK: Family = {
  slaDays: 2,
  reconcileQuantities: true,
  stages: [
    { name: "Bulk request" },
    { name: "Validation", requiresDocuments: true },
    { name: "Approval" },
    { name: "Processing" },
    { name: "Provider confirmation" },
    { name: "Reconciliation" },
  ],
  documents: [
    { name: "Client request list", required: true },
    { name: "Provider report / confirmation", required: true, isOutput: true },
  ],
  tasks: [
    { title: "Validate request list", dueOffsetDays: 0 },
    { title: "Process batch with operator", dueOffsetDays: 1 },
    { title: "Reconcile processed vs failed", dueOffsetDays: 2 },
  ],
  fields: [
    { key: "operator", label: "Operator / provider", type: "text" },
    { key: "quantityRequested", label: "Quantity requested", type: "number" },
    { key: "quantityProcessed", label: "Quantity processed", type: "number" },
    { key: "quantityFailed", label: "Quantity failed", type: "number" },
    { key: "providerReference", label: "Provider reference", type: "text" },
  ],
};

function services(
  category: ServiceCategory,
  jobPrefix: string,
  family: Family,
  entries: [code: string, name: string, description?: string][],
): ServiceTemplate[] {
  return entries.map(([code, name, description]) => ({ code, name, category, jobPrefix, description, ...family }));
}

export const DEFAULT_SERVICE_CATALOG: ServiceTemplate[] = [
  ...services("LOGISTICS", "LOG", IMPORT_LOGISTICS, [["IMPORT_LOGISTICS", "Import Logistics"]]),
  ...services("LOGISTICS", "LOG", EXPORT_LOGISTICS, [["EXPORT_LOGISTICS", "Export Logistics"]]),
  ...services("LOGISTICS", "LOG", IMPORT_LOGISTICS, [["FREIGHT_FORWARDING", "Freight Forwarding"]]),
  ...services("LOGISTICS", "LOG", GENERIC_LOGISTICS, [
    ["CUSTOMS_CLEARANCE", "Customs Clearance"],
    ["PORT_HANDLING", "Port Handling"],
    ["CARGO_HANDLING", "Cargo Handling"],
    ["DOOR_TO_DOOR", "Door-to-Door Delivery"],
    ["WAREHOUSING", "Warehousing"],
  ]),
  ...services("TRANSPORT", "TRN", TRANSPORT_TRIP, [
    ["IMPORT_TRANSPORT", "Import Transportation"],
    ["EXPORT_TRANSPORT", "Export Transportation"],
    ["DOMESTIC_TRANSPORT", "Domestic Transport"],
  ]),
  ...services("GOVERNMENT_TAX", "TAX", TAX_EXEMPTION, [["TAX_EXEMPTION", "Tax Exemption Processing"]]),
  ...services("GOVERNMENT_TAX", "GOV", GOVERNMENT_DOCS, [
    ["GOVERNMENT_DOCUMENTATION", "Government Documentation"],
    ["MINISTRY_SUBMISSION", "Ministry Submission"],
    ["MINISTRY_FOLLOW_UP", "Ministry Follow-up"],
    ["CERTIFICATE_COLLECTION", "Approval / Certificate Collection"],
  ]),
  ...services("VEHICLE", "RENT", VEHICLE_RENTAL, [
    ["CAR_RENTAL", "Car Rental"],
    ["TRUCK_RENTAL", "Truck Rental"],
    ["VEHICLE_WITH_DRIVER", "Vehicle with Driver"],
    ["LONG_TERM_RENTAL", "Long-Term Vehicle Rental"],
    ["SHORT_TERM_RENTAL", "Short-Term Vehicle Rental"],
    ["ARMOURED_VEHICLE_RENTAL", "Armoured Vehicle Rental (B6)"],
  ]),
  ...services("IMMIGRATION", "IMM", IMMIGRATION, [
    ["VISA_SUPPORT", "Visa Support"],
    ["IMMIGRATION_DOCUMENTATION", "Immigration Documentation"],
    ["APPLICATION_SUBMISSION", "Application Submission"],
    ["IMMIGRATION_FOLLOW_UP", "Immigration Follow-up"],
    ["PERMIT_SUPPORT", "Permit Support"],
    ["OTHER_IMMIGRATION_SUPPORT", "Other Immigration Support Services"],
  ]),
  ...services("COMMUNICATION", "COM", COMMUNICATION_SINGLE, [
    ["SIM_REGISTRATION", "SIM Registration"],
    ["SIM_ACTIVATION", "SIM Activation"],
    ["SIM_REPLACEMENT", "SIM Replacement"],
    ["SIM_TOP_UP", "SIM Top-up"],
    ["CORPORATE_SIM_MANAGEMENT", "Corporate SIM Management"],
    ["MOBILE_SUPPORT", "Mobile Communication Support"],
    ["OTHER_TELECOM", "Other Telecom Services"],
  ]),
  ...services("COMMUNICATION", "COM", COMMUNICATION_BULK, [
    ["BULK_TOP_UP", "Bulk Top-up"],
    ["BULK_SIM_SERVICES", "Bulk SIM Services"],
  ]),
];
