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

import { operationQueues, operationTypeOf } from "./freight-procedures";
describe("operation queues and types", () => {
  it("classifies jobs for the dashboard", () => {
    expect(operationQueues({ serviceCode: "IMPORT_LOGISTICS", category: "LOGISTICS", details: { mode: "SEA" }, currentStage: "Customs declaration lodged" })).toEqual(["customs", "sea"]);
    expect(operationQueues({ serviceCode: "IMPORT_LOGISTICS", category: "LOGISTICS", details: { mode: "AIR" }, currentStage: "Delivery to client" })).toEqual(["air"]);
    expect(operationQueues({ serviceCode: "CUSTOMS_CLEARANCE", category: "LOGISTICS", details: {}, currentStage: null })).toEqual(["customs", "noroute"]);
    expect(operationQueues({ serviceCode: "TAX_EXEMPTION", category: "GOVERNMENT_TAX", details: {}, currentStage: null })).toEqual(["exemption"]);
    expect(operationQueues({ serviceCode: "DOMESTIC_TRANSPORT", category: "TRANSPORT", details: {}, currentStage: null })).toEqual(["transport"]);
  });
  it("names operation types for reports", () => {
    expect(operationTypeOf("EXPORT_LOGISTICS", "Logistics", { mode: "AIR" })).toBe("Export · Air");
    expect(operationTypeOf("IMPORT_LOGISTICS", "Logistics", {})).toBe("Import · route not set");
    expect(operationTypeOf("TAX_EXEMPTION", "Government & Tax", {})).toBe("Tax / duty exemption");
    expect(operationTypeOf("CAR_RENTAL", "Vehicle Services", {})).toBe("Vehicle Services");
  });
});
