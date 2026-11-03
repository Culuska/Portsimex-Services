// Duty / tax exemption routing through the ministries.
//
// The file always goes to the Ministry of Foreign Affairs first. Foreign
// Affairs forwards it to each related line ministry (Security, Health,
// Justice); each of those reviews it and sends it BACK to Foreign Affairs.
// Foreign Affairs then writes to the Ministry of Finance, which gives the
// final decision -- Finance does not send it back to Foreign Affairs.
// When Finance is the only related ministry, Foreign Affairs writes to
// Finance directly.
//
// An exemption requested for a cargo operation shares that operation's
// serial number: JOB-LOG-2026-0004 -> JOB-LOG-2026-0004-EX.
//
// Pure module (no app imports) so it is unit tested directly.

import type { DocumentTemplate } from "./service-templates";

export const LINE_MINISTRIES = ["SECURITY", "HEALTH", "JUSTICE"] as const;
export type LineMinistry = (typeof LINE_MINISTRIES)[number];

export const MINISTRY_NAMES: Record<LineMinistry | "FOREIGN_AFFAIRS" | "FINANCE", string> = {
  FOREIGN_AFFAIRS: "Ministry of Foreign Affairs",
  SECURITY: "Ministry of Security",
  HEALTH: "Ministry of Health",
  JUSTICE: "Ministry of Justice",
  FINANCE: "Ministry of Finance",
};

/** Services handled as a duty / tax exemption case. */
export function isExemptionService(serviceCode: string): boolean {
  return serviceCode === "TAX_EXEMPTION";
}

/** Operations an exemption can be requested for (cargo, transport). */
export function canHaveLinkedExemption(category: string): boolean {
  return category === "LOGISTICS" || category === "TRANSPORT";
}

function isLineMinistry(v: unknown): v is LineMinistry {
  return typeof v === "string" && (LINE_MINISTRIES as readonly string[]).includes(v);
}

export function parseRoute(values: unknown[]): LineMinistry[] {
  return LINE_MINISTRIES.filter((m) => values.some((v) => v === m));
}

/** The ministries chosen for a job (details.exemptionRoute), or null if not chosen yet. */
export function jobExemptionRoute(details: Record<string, unknown>): LineMinistry[] | null {
  const r = details.exemptionRoute;
  return Array.isArray(r) ? LINE_MINISTRIES.filter((m) => r.some((v) => v === m && isLineMinistry(v))) : null;
}

export function routeLabel(route: LineMinistry[]): string {
  const via = route.map((m) => MINISTRY_NAMES[m].replace("Ministry of ", ""));
  return via.length ? `Foreign Affairs → ${via.join(", ")} → Foreign Affairs → Finance` : "Foreign Affairs → Finance";
}

export type ExemptionStage = { name: string; requiresDocuments?: boolean; hint: string };

const MOFA = MINISTRY_NAMES.FOREIGN_AFFAIRS;
const MOF = MINISTRY_NAMES.FINANCE;

export function exemptionProcedure(route: LineMinistry[]): { stages: ExemptionStage[]; documents: DocumentTemplate[] } {
  const stages: ExemptionStage[] = [
    { name: "Documents collected from client", hint: "Collect the client's request letter, supplier invoice, import / purchase documents and organization documents." },
    { name: "Document verification", requiresDocuments: true, hint: "Check every document is complete and correct, then prepare the exemption application." },
    { name: `Submitted to ${MOFA}`, hint: `Submit the application and documents to the ${MOFA}; record the reference number.` },
  ];
  for (const m of route) {
    const name = MINISTRY_NAMES[m];
    stages.push(
      { name: `Forwarded by Foreign Affairs to ${name}`, hint: `Foreign Affairs sends the file to the ${name}. Follow up until it is received there.` },
      { name: `${name} review`, hint: `The ${name} reviews the file. If they ask for anything missing, record it with "Missing documents".` },
      { name: `Returned by ${name} to Foreign Affairs`, hint: `The ${name} sends its clearance back to Foreign Affairs; collect a copy of the letter.` },
    );
  }
  stages.push(
    { name: `Foreign Affairs letter to ${MOF}`, hint: `Foreign Affairs writes to the ${MOF} requesting the exemption; get a copy of the letter.` },
    { name: `${MOF} review`, hint: `The ${MOF} reviews the request. Finance gives the final decision and does not send it back to Foreign Affairs.` },
    { name: `Exemption approved by ${MOF}`, hint: "Record the approval (or rejection) and the exemption reference." },
    { name: "Exemption certificate collected", hint: "Collect the signed exemption certificate / approval letter from Finance." },
    { name: "Delivered to client", hint: "Give the certificate to the client (or use it for the related cargo clearance)." },
  );

  const documents: DocumentTemplate[] = [
    { name: "Client request letter", required: true },
    { name: "Supplier invoice", required: true },
    { name: "Purchase / import documents", required: true },
    { name: "Organization documentation", required: true },
    { name: "Exemption application", required: true },
    { name: "Supporting documents", required: false },
    // Letters along the route: kept on file, collected as the case moves.
    { name: "Foreign Affairs forwarding letter", required: false },
    ...route.map((m) => ({ name: `${MINISTRY_NAMES[m]} clearance letter`, required: false })),
    { name: `Foreign Affairs letter to ${MOF}`, required: false },
    { name: "Tax exemption certificate", required: true, isOutput: true },
  ];
  return { stages, documents };
}

export function exemptionStageHint(details: Record<string, unknown>, stageName: string): string | null {
  const route = jobExemptionRoute(details);
  if (!route) return null;
  return exemptionProcedure(route).stages.find((s) => s.name === stageName)?.hint ?? null;
}

/** JOB-LOG-2026-0004 -> JOB-LOG-2026-0004-EX (then -EX2, -EX3 ... if taken). */
export function linkedExemptionNumber(parentJobNumber: string, taken: Set<string>): string {
  const base = `${parentJobNumber}-EX`;
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}${i}`)) return `${base}${i}`;
}

/** Ministries a missing-document request can come from, for suggestions. */
export function requesterSuggestions(route: LineMinistry[] | null): string[] {
  return [MOFA, ...(route ?? LINE_MINISTRIES).map((m) => MINISTRY_NAMES[m]), MOF, "Customs", "Client"];
}

/** Appends a dated line to a stage's note log. */
export function appendNote(existing: string | null, line: string, at: Date, by: string | null | undefined): string {
  const entry = `${at.toISOString().slice(0, 10)} · ${by ?? "Someone"}: ${line.trim()}`;
  return existing ? `${existing}\n${entry}` : entry;
}
