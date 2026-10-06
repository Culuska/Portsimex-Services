// Pure formatting for runtime-keyed document numbers (unit tested).

export function jobCounterKey(prefix: string, year: number) {
  return `JOB-${normalizePrefix(prefix)}-${year}`;
}

export function formatJobNumber(prefix: string, year: number, seq: number) {
  return `${jobCounterKey(prefix, year)}-${String(seq).padStart(4, "0")}`;
}

export function serviceRequestCounterKey(year: number) {
  return `SR-${year}`;
}

export function formatServiceRequestNumber(year: number, seq: number) {
  return `SR-${year}-${String(seq).padStart(5, "0")}`;
}

export function normalizePrefix(prefix: string) {
  const clean = prefix.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  return clean || "JOB";
}
