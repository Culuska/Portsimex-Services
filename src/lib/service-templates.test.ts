import { describe, expect, it } from "vitest";
import {
  DEFAULT_SERVICE_CATALOG,
  documentsFromLines,
  documentsToLines,
  fieldsFromLines,
  fieldsToLines,
  parseDocuments,
  parseFields,
  parseStages,
  stagesFromLines,
  stagesToLines,
  tasksFromLines,
} from "./service-templates";
import { formatJobNumber, formatServiceRequestNumber, normalizePrefix } from "./document-numbers";

describe("default catalog", () => {
  it("has unique codes and a workflow for every service", () => {
    const codes = DEFAULT_SERVICE_CATALOG.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const s of DEFAULT_SERVICE_CATALOG) {
      expect(s.stages.length).toBeGreaterThan(0);
      expect(s.documents.some((d) => d.isOutput)).toBe(true);
    }
  });
  it("includes every service family from the brief", () => {
    const cats = new Set(DEFAULT_SERVICE_CATALOG.map((s) => s.category));
    for (const c of ["LOGISTICS", "TRANSPORT", "GOVERNMENT_TAX", "VEHICLE", "IMMIGRATION", "COMMUNICATION"]) expect(cats.has(c as never)).toBe(true);
  });
  it("only bulk communication services reconcile quantities", () => {
    expect(DEFAULT_SERVICE_CATALOG.filter((s) => s.reconcileQuantities).map((s) => s.code)).toEqual(["BULK_TOP_UP", "BULK_SIM_SERVICES"]);
  });
});

describe("JSON parsing is defensive", () => {
  it("drops malformed entries", () => {
    expect(parseStages([{ name: "A" }, { nope: 1 }, "x", null])).toEqual([{ name: "A", requiresDocuments: false }]);
    expect(parseDocuments("not an array")).toEqual([]);
    expect(parseFields([{ key: "a", label: "A", type: "bogus" }, { key: "a", label: "dup" }])).toEqual([{ key: "a", label: "A", type: "text" }]);
  });
});

describe("admin line format round-trips", () => {
  it("stages", () => {
    const s = stagesFromLines("Collect\nVerify | docs\n\n");
    expect(s).toEqual([{ name: "Collect", requiresDocuments: false }, { name: "Verify", requiresDocuments: true }]);
    expect(stagesToLines(s)).toBe("Collect\nVerify | docs");
  });
  it("documents", () => {
    const d = documentsFromLines("Passport\nPhotos | optional\nVisa | output");
    expect(d).toEqual([
      { name: "Passport", required: true, isOutput: false },
      { name: "Photos", required: false, isOutput: false },
      { name: "Visa", required: true, isOutput: true },
    ]);
    expect(documentsToLines(d)).toBe("Passport\nPhotos | optional\nVisa | output");
  });
  it("tasks and fields", () => {
    expect(tasksFromLines("Submit | 3\nFollow up")).toEqual([{ title: "Submit", dueOffsetDays: 3 }, { title: "Follow up", dueOffsetDays: undefined }]);
    const f = fieldsFromLines("tax Type | Tax type | select | VAT, Duty\nqty | Quantity | number");
    expect(f).toEqual([
      { key: "taxType", label: "Tax type", type: "select", options: ["VAT", "Duty"] },
      { key: "qty", label: "Quantity", type: "number" },
    ]);
    expect(fieldsToLines(f)).toBe("taxType | Tax type | select | VAT, Duty\nqty | Quantity | number");
  });
});

describe("document numbers", () => {
  it("formats job and request numbers", () => {
    expect(formatJobNumber("tax", 2026, 2)).toBe("JOB-TAX-2026-0002");
    expect(formatServiceRequestNumber(2026, 1)).toBe("SR-2026-00001");
    expect(normalizePrefix(" r-e-n-t!! ")).toBe("RENT");
    expect(normalizePrefix("")).toBe("JOB");
  });
});
