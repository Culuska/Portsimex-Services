import { describe, expect, it } from "vitest";
import { FREIGHT_MODES, freightKindOf, freightProcedure, jobFields, jobFreightMode, stageHint, type FreightKind } from "./freight-procedures";

const KINDS: FreightKind[] = ["IMPORT", "EXPORT", "CLEARANCE"];

describe("freight procedures", () => {
  for (const kind of KINDS)
    for (const mode of FREIGHT_MODES) {
      const p = freightProcedure(kind, mode);
      it(`${mode} ${kind} is a complete, consistent procedure`, () => {
        const names = p.stages.map((s) => s.name);
        expect(new Set(names).size).toBe(names.length);
        expect(p.stages.every((s) => s.hint.length > 10)).toBe(true);
        expect(p.documents.filter((d) => d.isOutput)).toHaveLength(1);
        const docNames = p.documents.map((d) => d.name.toLowerCase());
        expect(new Set(docNames).size).toBe(docNames.length);
        // The stage that needs complete documents comes after the documents are collected.
        const gate = p.stages.findIndex((s) => s.requiresDocuments);
        expect(gate).toBeGreaterThanOrEqual(0);
        expect(p.fields.length).toBeGreaterThan(5);
        expect(p.tasks.length).toBeGreaterThan(3);
      });
    }

  it("air and sea differ where it matters", () => {
    const sea = freightProcedure("IMPORT", "SEA");
    const air = freightProcedure("IMPORT", "AIR");
    expect(sea.stages.some((s) => /empty container/i.test(s.name))).toBe(true);
    expect(air.stages.some((s) => /container/i.test(s.name))).toBe(false);
    expect(sea.documents.some((d) => /bill of lading/i.test(d.name))).toBe(true);
    expect(air.documents.some((d) => /air waybill/i.test(d.name))).toBe(true);
    expect(sea.fields.some((f) => f.key === "vessel")).toBe(true);
    expect(air.fields.some((f) => f.key === "flight")).toBe(true);
  });

  it("only freight services follow a procedure", () => {
    expect(freightKindOf("IMPORT_LOGISTICS")).toBe("IMPORT");
    expect(freightKindOf("EXPORT_LOGISTICS")).toBe("EXPORT");
    expect(freightKindOf("CUSTOMS_CLEARANCE")).toBe("CLEARANCE");
    expect(freightKindOf("TAX_EXEMPTION")).toBeNull();
  });

  it("reads the route from job details and picks fields and hints", () => {
    expect(jobFreightMode({ mode: "AIR" })).toBe("AIR");
    expect(jobFreightMode({ mode: "boat" })).toBeNull();
    const generic = [{ key: "origin", label: "Origin", type: "text" as const }];
    expect(jobFields("IMPORT_LOGISTICS", generic, {})).toBe(generic);
    expect(jobFields("IMPORT_LOGISTICS", generic, { mode: "SEA" }).some((f) => f.key === "blNumber")).toBe(true);
    expect(jobFields("TAX_EXEMPTION", generic, { mode: "SEA" })).toBe(generic);
    expect(stageHint("IMPORT_LOGISTICS", { mode: "SEA" }, "Delivery order from shipping line")).toMatch(/Delivery Order/);
    expect(stageHint("IMPORT_LOGISTICS", {}, "Delivery order from shipping line")).toBeNull();
  });
});
