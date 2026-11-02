import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, PERMISSION_LAYOUT } from "./permission-catalog";

describe("PERMISSION_LAYOUT", () => {
  it("shows every permission exactly once", () => {
    const shown = PERMISSION_LAYOUT.flatMap((g) => g.areas.flatMap((a) => a.items.map(([p]) => p)));
    expect(new Set(shown).size).toBe(shown.length);
    expect([...shown].sort()).toEqual([...ALL_PERMISSIONS].sort());
  });
});
