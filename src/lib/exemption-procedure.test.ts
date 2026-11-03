import { describe, expect, it } from "vitest";
import { appendNote, exemptionProcedure, jobExemptionRoute, linkedExemptionNumber, parseRoute, routeLabel } from "./exemption-procedure";
import { STAGE_EVENTS, stagesToAutoComplete } from "./case-status";

const names = (route: Parameters<typeof exemptionProcedure>[0]) => exemptionProcedure(route).stages.map((s) => s.name);

describe("exemption ministry route", () => {
  it("Finance only: Foreign Affairs writes straight to Finance", () => {
    const n = names([]);
    expect(n.indexOf("Submitted to Ministry of Foreign Affairs")).toBeLessThan(n.indexOf("Foreign Affairs letter to Ministry of Finance"));
    expect(n.some((x) => /Health|Security|Justice/.test(x))).toBe(false);
  });

  it("each line ministry goes out from and back to Foreign Affairs, before Finance", () => {
    const n = names(["HEALTH", "SECURITY"]);
    const at = (x: string) => n.indexOf(x);
    expect(at("Forwarded by Foreign Affairs to Ministry of Security")).toBeGreaterThan(at("Submitted to Ministry of Foreign Affairs"));
    expect(at("Returned by Ministry of Security to Foreign Affairs")).toBeGreaterThan(at("Ministry of Security review"));
    expect(at("Returned by Ministry of Health to Foreign Affairs")).toBeGreaterThan(at("Ministry of Health review"));
    expect(at("Foreign Affairs letter to Ministry of Finance")).toBeGreaterThan(at("Returned by Ministry of Health to Foreign Affairs"));
    // Finance gives the final decision -- nothing returns from Finance to Foreign Affairs.
    expect(n.some((x) => /Returned by Ministry of Finance/.test(x))).toBe(false);
    expect(new Set(n).size).toBe(n.length);
  });

  it("documents: one official output, a clearance letter per line ministry", () => {
    const d = exemptionProcedure(["JUSTICE"]).documents;
    expect(d.filter((x) => x.isOutput).map((x) => x.name)).toEqual(["Tax exemption certificate"]);
    expect(d.some((x) => x.name === "Ministry of Justice clearance letter")).toBe(true);
  });

  it("case events still move the right stages", () => {
    const stages = names(["HEALTH"]).map((name, i) => ({ id: String(i), name, position: i, status: i < 2 ? "DONE" : "PENDING" }));
    expect(stagesToAutoComplete(stages, STAGE_EVENTS.SUBMITTED).map((s) => s.name)).toEqual(["Submitted to Ministry of Foreign Affairs"]);
    const atFinance = stages.map((s) => ({ ...s, status: s.name === "Ministry of Finance review" || s.position > stages.find((x) => x.name === "Ministry of Finance review")!.position ? "PENDING" : "DONE" }));
    expect(stagesToAutoComplete(atFinance, STAGE_EVENTS.DECIDED).map((s) => s.name)).toEqual(["Ministry of Finance review", "Exemption approved by Ministry of Finance"]);
  });

  it("parses and labels the route", () => {
    expect(parseRoute(["JUSTICE", "nonsense", "HEALTH"])).toEqual(["HEALTH", "JUSTICE"]);
    expect(jobExemptionRoute({})).toBeNull();
    expect(jobExemptionRoute({ exemptionRoute: [] })).toEqual([]);
    expect(jobExemptionRoute({ exemptionRoute: ["HEALTH"] })).toEqual(["HEALTH"]);
    expect(routeLabel([])).toBe("Foreign Affairs → Finance");
    expect(routeLabel(["HEALTH"])).toBe("Foreign Affairs → Health → Foreign Affairs → Finance");
  });

  it("shares the operation's serial number", () => {
    expect(linkedExemptionNumber("JOB-LOG-2026-0004", new Set())).toBe("JOB-LOG-2026-0004-EX");
    expect(linkedExemptionNumber("JOB-LOG-2026-0004", new Set(["JOB-LOG-2026-0004-EX"]))).toBe("JOB-LOG-2026-0004-EX2");
  });

  it("keeps a dated note log", () => {
    const d = new Date("2026-11-03T10:00:00Z");
    const one = appendNote(null, "Called MoFA", d, "Jejey");
    expect(one).toBe("2026-11-03 · Jejey: Called MoFA");
    expect(appendNote(one, "Waiting", d, null).split("\n")).toHaveLength(2);
  });
});
