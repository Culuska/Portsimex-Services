import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, PERMISSION_LAYOUT, SUPER_ADMIN_ONLY } from "./permission-catalog";

describe("PERMISSION_LAYOUT", () => {
  it("shows every grantable permission exactly once", () => {
    const shown = PERMISSION_LAYOUT.flatMap((g) => g.areas.flatMap((a) => a.items.map(([p]) => p)));
    expect(new Set(shown).size).toBe(shown.length);
    expect([...shown].sort()).toEqual(ALL_PERMISSIONS.filter((p) => !SUPER_ADMIN_ONLY.includes(p)).sort());
  });
});
