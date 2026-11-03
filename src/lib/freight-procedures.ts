// Standard freight procedures by route: the real steps a shipment goes
// through at the AIRPORT (air cargo terminal) or the SEAPORT (container
// terminal), for imports, exports and customs clearance. A freight job
// starts with its service's generic stages; once operations choose the
// route, the job's stages, document checklist, tasks and shipment fields
// are replaced with the matching procedure below.
//
// Pure module (no app imports) so it is unit tested directly.

import type { DocumentTemplate, FieldTemplate, StageTemplate, TaskTemplate } from "./service-templates";

export const FREIGHT_MODES = ["SEA", "AIR"] as const;
export type FreightMode = (typeof FREIGHT_MODES)[number];
export type FreightKind = "IMPORT" | "EXPORT" | "CLEARANCE";

export const FREIGHT_MODE_LABELS: Record<FreightMode, string> = { SEA: "Seaport", AIR: "Airport" };
export const FREIGHT_MODE_ICONS: Record<FreightMode, string> = { SEA: "⚓", AIR: "✈" };
const KIND_LABELS: Record<FreightKind, string> = { IMPORT: "import", EXPORT: "export", CLEARANCE: "customs clearance" };

/** Which catalog services follow a freight procedure, and which one. */
const SERVICE_KINDS: Record<string, FreightKind> = {
  IMPORT_LOGISTICS: "IMPORT",
  FREIGHT_FORWARDING: "IMPORT",
  EXPORT_LOGISTICS: "EXPORT",
  CUSTOMS_CLEARANCE: "CLEARANCE",
};

export function freightKindOf(serviceCode: string): FreightKind | null {
  return SERVICE_KINDS[serviceCode] ?? null;
}

export function isFreightMode(v: unknown): v is FreightMode {
  return typeof v === "string" && (FREIGHT_MODES as readonly string[]).includes(v);
}

/** The route recorded on a job (details.mode), if any. */
export function jobFreightMode(details: Record<string, unknown>): FreightMode | null {
  return isFreightMode(details.mode) ? details.mode : null;
}

export type ProcedureStage = StageTemplate & { hint: string };
export type FreightProcedure = {
  title: string;
  slaDays: number;
  stages: ProcedureStage[];
  documents: DocumentTemplate[];
  tasks: TaskTemplate[];
  fields: FieldTemplate[];
};

// ---------------------------------------------------------------------------
// Shipment fields
// ---------------------------------------------------------------------------

const SEA_FIELDS: FieldTemplate[] = [
  { key: "shippingLine", label: "Shipping line", type: "text" },
  { key: "vessel", label: "Vessel name", type: "text" },
  { key: "voyage", label: "Voyage number", type: "text" },
  { key: "blNumber", label: "Bill of lading (B/L) number", type: "text" },
  { key: "containerType", label: "Container type", type: "select", options: ["20ft", "40ft", "40ft High Cube", "Reefer", "LCL (shared)", "Break bulk / RoRo"] },
  { key: "container", label: "Container number(s)", type: "text" },
  { key: "portOfLoading", label: "Port of loading", type: "text" },
  { key: "portOfDischarge", label: "Port of discharge", type: "text" },
  { key: "cargo", label: "Cargo description", type: "text" },
  { key: "packages", label: "Packages", type: "number" },
  { key: "weightKg", label: "Gross weight (kg)", type: "number" },
  { key: "volumeCbm", label: "Volume (CBM)", type: "number" },
  { key: "etd", label: "ETD (departure)", type: "date" },
  { key: "eta", label: "ETA (arrival)", type: "date" },
  { key: "freeDays", label: "Free days before demurrage", type: "number" },
  { key: "customsRef", label: "Customs entry / declaration number", type: "text" },
];

const AIR_FIELDS: FieldTemplate[] = [
  { key: "airline", label: "Airline", type: "text" },
  { key: "flight", label: "Flight number", type: "text" },
  { key: "mawb", label: "Master air waybill (MAWB)", type: "text" },
  { key: "hawb", label: "House air waybill (HAWB)", type: "text" },
  { key: "airportOfDeparture", label: "Airport of departure", type: "text" },
  { key: "airportOfArrival", label: "Airport of arrival", type: "text" },
  { key: "cargo", label: "Cargo description", type: "text" },
  { key: "pieces", label: "Pieces", type: "number" },
  { key: "weightKg", label: "Gross weight (kg)", type: "number" },
  { key: "chargeableKg", label: "Chargeable weight (kg)", type: "number" },
  { key: "cargoType", label: "Cargo type", type: "select", options: ["General", "Perishable", "Dangerous goods", "Valuable", "Live animals", "Pharma / temperature controlled"] },
  { key: "etd", label: "ETD (departure)", type: "date" },
  { key: "eta", label: "ETA (arrival)", type: "date" },
  { key: "customsRef", label: "Customs entry / declaration number", type: "text" },
];

// ---------------------------------------------------------------------------
// Procedures
// ---------------------------------------------------------------------------

const SEA_IMPORT: FreightProcedure = {
  title: "Seaport import procedure",
  slaDays: 21,
  stages: [
    { name: "Pre-arrival documents", hint: "Get the original or telex-released B/L, commercial invoice, packing list and any import permit from the client." },
    { name: "Vessel arrival & manifest check", hint: "Confirm the vessel has berthed and the container is on the cargo manifest; note the free days before demurrage." },
    { name: "Delivery order from shipping line", hint: "Pay the shipping line's local charges and collect the Delivery Order (DO)." },
    { name: "Customs declaration lodged", hint: "Lodge the import declaration / entry with customs using the B/L, invoice and packing list." },
    { name: "Duties & taxes paid", hint: "Pay the assessed import duty and taxes (or apply the tax exemption) and keep the receipt." },
    { name: "Customs inspection", hint: "Attend the physical or scanner inspection at the port if customs selects the container." },
    { name: "Port charges & release order", requiresDocuments: true, hint: "Pay port / terminal handling and storage charges and obtain the release order. All supporting documents must be in." },
    { name: "Container gate-out", hint: "Load the container on the truck and clear the port gate." },
    { name: "Delivery to client", hint: "Transport the cargo to the client's warehouse or site." },
    { name: "Empty container return", hint: "Return the empty container to the shipping line's depot before detention starts; keep the interchange receipt." },
    { name: "Proof of delivery", hint: "Get the delivery note signed and stamped by the client (POD)." },
  ],
  documents: [
    { name: "Bill of lading (original / telex release)", required: true },
    { name: "Commercial invoice", required: true },
    { name: "Packing list", required: true },
    { name: "Certificate of origin", required: false },
    { name: "Import permit / licence", required: false },
    { name: "Delivery order (shipping line)", required: true },
    { name: "Customs declaration / entry", required: true },
    { name: "Duty & tax payment receipt", required: true },
    { name: "Port release order", required: true },
    { name: "Container interchange receipt (empty return)", required: false },
    { name: "Proof of delivery (POD)", required: true, isOutput: true },
  ],
  tasks: [
    { title: "Collect B/L, invoice and packing list from client", dueOffsetDays: 1 },
    { title: "Check vessel ETA and free days with shipping line", dueOffsetDays: 2 },
    { title: "Pay local charges and collect delivery order", dueOffsetDays: 5 },
    { title: "Lodge customs declaration", dueOffsetDays: 6 },
    { title: "Pay duties and taxes", dueOffsetDays: 8 },
    { title: "Pay port charges and obtain release", dueOffsetDays: 11 },
    { title: "Book truck and gate-out container", dueOffsetDays: 12 },
    { title: "Return empty container to depot", dueOffsetDays: 16 },
    { title: "Obtain signed proof of delivery", dueOffsetDays: 14 },
  ],
  fields: SEA_FIELDS,
};

const AIR_IMPORT: FreightProcedure = {
  title: "Airport import procedure",
  slaDays: 7,
  stages: [
    { name: "Pre-alert documents", hint: "Get the air waybill (MAWB/HAWB), commercial invoice, packing list and any import permit before the flight lands." },
    { name: "Flight arrival & cargo check-in", hint: "Confirm the flight landed and the cargo is received in the airport cargo terminal (warehouse); check piece count." },
    { name: "Airline release / delivery order", hint: "Pay the airline / handling agent charges and collect the release note." },
    { name: "Customs declaration lodged", hint: "Lodge the import declaration with customs using the AWB, invoice and packing list." },
    { name: "Duties & taxes paid", hint: "Pay the assessed import duty and taxes (or apply the tax exemption) and keep the receipt." },
    { name: "Customs examination", hint: "Attend the customs examination at the cargo terminal if selected." },
    { name: "Warehouse release", requiresDocuments: true, hint: "Pay terminal storage charges and collect the cargo from the airport warehouse. All supporting documents must be in." },
    { name: "Delivery to client", hint: "Transport the cargo from the airport to the client." },
    { name: "Proof of delivery", hint: "Get the delivery note signed and stamped by the client (POD)." },
  ],
  documents: [
    { name: "Air waybill (MAWB / HAWB)", required: true },
    { name: "Commercial invoice", required: true },
    { name: "Packing list", required: true },
    { name: "Certificate of origin", required: false },
    { name: "Import permit / licence", required: false },
    { name: "Airline release note / delivery order", required: true },
    { name: "Customs declaration / entry", required: true },
    { name: "Duty & tax payment receipt", required: true },
    { name: "Airport warehouse release", required: true },
    { name: "Proof of delivery (POD)", required: true, isOutput: true },
  ],
  tasks: [
    { title: "Collect AWB, invoice and packing list (pre-alert)", dueOffsetDays: 0 },
    { title: "Confirm flight arrival and cargo check-in", dueOffsetDays: 1 },
    { title: "Pay airline charges and collect release note", dueOffsetDays: 2 },
    { title: "Lodge customs declaration", dueOffsetDays: 2 },
    { title: "Pay duties and taxes", dueOffsetDays: 3 },
    { title: "Collect cargo from airport warehouse", dueOffsetDays: 4 },
    { title: "Obtain signed proof of delivery", dueOffsetDays: 5 },
  ],
  fields: AIR_FIELDS,
};

const SEA_EXPORT: FreightProcedure = {
  title: "Seaport export procedure",
  slaDays: 14,
  stages: [
    { name: "Booking with shipping line", hint: "Book space and the container on a vessel; get the booking confirmation and cut-off dates." },
    { name: "Export documents", requiresDocuments: true, hint: "Prepare the commercial invoice, packing list, export permit and certificate of origin." },
    { name: "Empty container pick-up & stuffing", hint: "Collect the empty container, load (stuff) the cargo at the client and seal it." },
    { name: "Export customs declaration", hint: "Lodge the export declaration and attend the customs inspection if selected." },
    { name: "Container gate-in at port", hint: "Deliver the container to the port before the cut-off and pay port charges." },
    { name: "VGM & loading on vessel", hint: "Submit the verified gross mass (VGM) and confirm the container is loaded." },
    { name: "Vessel departure & B/L issued", hint: "Confirm the vessel sailed and obtain the bill of lading from the shipping line." },
    { name: "Documents sent to client", hint: "Send the B/L and export documents to the client / consignee." },
  ],
  documents: [
    { name: "Booking confirmation", required: true },
    { name: "Commercial invoice", required: true },
    { name: "Packing list", required: true },
    { name: "Export permit / licence", required: false },
    { name: "Certificate of origin", required: false },
    { name: "Export declaration", required: true },
    { name: "VGM certificate", required: true },
    { name: "Bill of lading (issued)", required: true, isOutput: true },
  ],
  tasks: [
    { title: "Book container space with shipping line", dueOffsetDays: 1 },
    { title: "Prepare export documents", dueOffsetDays: 3 },
    { title: "Pick up empty container and stuff cargo", dueOffsetDays: 5 },
    { title: "Lodge export declaration", dueOffsetDays: 6 },
    { title: "Gate-in container before cut-off", dueOffsetDays: 8 },
    { title: "Submit VGM", dueOffsetDays: 8 },
    { title: "Collect B/L and send to client", dueOffsetDays: 12 },
  ],
  fields: SEA_FIELDS,
};

const AIR_EXPORT: FreightProcedure = {
  title: "Airport export procedure",
  slaDays: 5,
  stages: [
    { name: "Booking with airline", hint: "Book space on a flight; confirm the cargo cut-off time at the terminal." },
    { name: "Export documents", requiresDocuments: true, hint: "Prepare the commercial invoice, packing list, export permit and any dangerous goods declaration." },
    { name: "Cargo delivered to airport terminal", hint: "Deliver the cargo to the airline's cargo terminal before cut-off." },
    { name: "Security screening & weighing", hint: "Cargo is screened (X-ray) and weighed; confirm the chargeable weight." },
    { name: "Export customs clearance", hint: "Lodge the export declaration and get customs clearance at the terminal." },
    { name: "AWB issued & cargo manifested", hint: "Get the air waybill issued and the cargo manifested on the flight." },
    { name: "Flight departure confirmed", hint: "Confirm the flight departed with the cargo on board." },
    { name: "Documents sent to client", hint: "Send the AWB and export documents to the client / consignee." },
  ],
  documents: [
    { name: "Booking confirmation", required: true },
    { name: "Commercial invoice", required: true },
    { name: "Packing list", required: true },
    { name: "Export permit / licence", required: false },
    { name: "Dangerous goods declaration", required: false },
    { name: "Export declaration", required: true },
    { name: "Air waybill (issued)", required: true, isOutput: true },
  ],
  tasks: [
    { title: "Book flight space with airline", dueOffsetDays: 0 },
    { title: "Prepare export documents", dueOffsetDays: 1 },
    { title: "Deliver cargo to airport terminal", dueOffsetDays: 2 },
    { title: "Lodge export declaration", dueOffsetDays: 2 },
    { title: "Collect AWB and send to client", dueOffsetDays: 4 },
  ],
  fields: AIR_FIELDS,
};

const SEA_CLEARANCE: FreightProcedure = {
  title: "Seaport customs clearance procedure",
  slaDays: 10,
  stages: [
    { name: "Clearance documents", hint: "Get the B/L, commercial invoice, packing list and any permits from the client." },
    { name: "Delivery order from shipping line", hint: "Pay the shipping line's local charges and collect the Delivery Order (DO)." },
    { name: "Customs declaration lodged", hint: "Lodge the declaration / entry with customs." },
    { name: "Duties & taxes paid", hint: "Pay the assessed duty and taxes (or apply the exemption) and keep the receipt." },
    { name: "Customs inspection", hint: "Attend the physical or scanner inspection at the port if selected." },
    { name: "Port charges & release order", requiresDocuments: true, hint: "Pay port charges and obtain the release order. All supporting documents must be in." },
    { name: "Cargo handed over", hint: "Hand the released cargo / container over to the client or their transporter." },
  ],
  documents: [
    { name: "Bill of lading (original / telex release)", required: true },
    { name: "Commercial invoice", required: true },
    { name: "Packing list", required: true },
    { name: "Import permit / licence", required: false },
    { name: "Delivery order (shipping line)", required: true },
    { name: "Customs declaration / entry", required: true },
    { name: "Duty & tax payment receipt", required: true },
    { name: "Port release order", required: true, isOutput: true },
  ],
  tasks: [
    { title: "Collect clearance documents from client", dueOffsetDays: 1 },
    { title: "Collect delivery order", dueOffsetDays: 3 },
    { title: "Lodge customs declaration", dueOffsetDays: 4 },
    { title: "Pay duties and taxes", dueOffsetDays: 6 },
    { title: "Obtain port release order", dueOffsetDays: 8 },
  ],
  fields: SEA_FIELDS,
};

const AIR_CLEARANCE: FreightProcedure = {
  title: "Airport customs clearance procedure",
  slaDays: 4,
  stages: [
    { name: "Clearance documents", hint: "Get the air waybill, commercial invoice, packing list and any permits from the client." },
    { name: "Airline release / delivery order", hint: "Pay the airline / handling agent charges and collect the release note." },
    { name: "Customs declaration lodged", hint: "Lodge the declaration with customs." },
    { name: "Duties & taxes paid", hint: "Pay the assessed duty and taxes (or apply the exemption) and keep the receipt." },
    { name: "Customs examination", hint: "Attend the examination at the cargo terminal if selected." },
    { name: "Warehouse release", requiresDocuments: true, hint: "Pay terminal storage charges and get the cargo released. All supporting documents must be in." },
    { name: "Cargo handed over", hint: "Hand the released cargo over to the client or their transporter." },
  ],
  documents: [
    { name: "Air waybill (MAWB / HAWB)", required: true },
    { name: "Commercial invoice", required: true },
    { name: "Packing list", required: true },
    { name: "Import permit / licence", required: false },
    { name: "Airline release note / delivery order", required: true },
    { name: "Customs declaration / entry", required: true },
    { name: "Duty & tax payment receipt", required: true },
    { name: "Airport warehouse release", required: true, isOutput: true },
  ],
  tasks: [
    { title: "Collect clearance documents from client", dueOffsetDays: 0 },
    { title: "Collect airline release note", dueOffsetDays: 1 },
    { title: "Lodge customs declaration", dueOffsetDays: 1 },
    { title: "Pay duties and taxes", dueOffsetDays: 2 },
    { title: "Obtain warehouse release", dueOffsetDays: 3 },
  ],
  fields: AIR_FIELDS,
};

const PROCEDURES: Record<FreightKind, Record<FreightMode, FreightProcedure>> = {
  IMPORT: { SEA: SEA_IMPORT, AIR: AIR_IMPORT },
  EXPORT: { SEA: SEA_EXPORT, AIR: AIR_EXPORT },
  CLEARANCE: { SEA: SEA_CLEARANCE, AIR: AIR_CLEARANCE },
};

export function freightProcedure(kind: FreightKind, mode: FreightMode): FreightProcedure {
  return PROCEDURES[kind][mode];
}

export function procedureLabel(kind: FreightKind, mode: FreightMode): string {
  return `${FREIGHT_MODE_ICONS[mode]} ${FREIGHT_MODE_LABELS[mode]} ${KIND_LABELS[kind]}`;
}

/** The "what to do" line for a stage of a freight job, if it follows a procedure. */
export function stageHint(serviceCode: string, details: Record<string, unknown>, stageName: string): string | null {
  const kind = freightKindOf(serviceCode);
  const mode = jobFreightMode(details);
  if (!kind || !mode) return null;
  return freightProcedure(kind, mode).stages.find((s) => s.name === stageName)?.hint ?? null;
}

/** Shipment fields for a job: the route's fields once chosen, else the service's own. */
export function jobFields(serviceCode: string, serviceFields: FieldTemplate[], details: Record<string, unknown>): FieldTemplate[] {
  const kind = freightKindOf(serviceCode);
  const mode = jobFreightMode(details);
  return kind && mode ? freightProcedure(kind, mode).fields : serviceFields;
}
