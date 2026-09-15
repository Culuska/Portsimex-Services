import { describe, expect, it } from "vitest";
import { deriveMnemonicBase, resolveMnemonicCollision } from "./client-mnemonic";

describe("deriveMnemonicBase", () => {
  it("takes the first 5 letters of a name with no punctuation trimmed", () => {
    expect(deriveMnemonicBase("Atlas Trading Co.")).toBe("ATLAS");
  });

  it("uppercases the result", () => {
    expect(deriveMnemonicBase("atlas")).toBe("ATLAS");
  });

  it("strips spaces and punctuation before counting characters", () => {
    expect(deriveMnemonicBase("A.B. Co")).toBe("ABCOX");
  });

  it("pads short names with X", () => {
    expect(deriveMnemonicBase("Al")).toBe("ALXXX");
  });

  it("handles an empty name", () => {
    expect(deriveMnemonicBase("")).toBe("XXXXX");
  });
});

describe("resolveMnemonicCollision", () => {
  it("returns the base unchanged when free", () => {
    expect(resolveMnemonicCollision("ATLAS", new Set())).toBe("ATLAS");
  });

  it("appends a digit when the base is taken", () => {
    expect(resolveMnemonicCollision("ATLAS", new Set(["ATLAS"]))).toBe("ATLA2");
  });

  it("tries the next digit when that is also taken", () => {
    expect(resolveMnemonicCollision("ATLAS", new Set(["ATLAS", "ATLA2"]))).toBe("ATLA3");
  });

  it("falls back to letters once digits 2-9 are exhausted", () => {
    const taken = new Set(["ATLAS", "ATLA2", "ATLA3", "ATLA4", "ATLA5", "ATLA6", "ATLA7", "ATLA8", "ATLA9"]);
    expect(resolveMnemonicCollision("ATLAS", taken)).toBe("ATLAA");
  });
});
