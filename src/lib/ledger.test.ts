import { describe, expect, it } from "vitest";
import { accountBalance } from "./ledger";

describe("accountBalance", () => {
  it("computes an ASSET account's natural debit balance", () => {
    const balance = accountBalance("ASSET", [
      { direction: "DEBIT", amount: 1000 },
      { direction: "CREDIT", amount: 400 },
    ]);
    expect(balance).toBe(600);
  });

  it("computes a LIABILITY account's natural credit balance", () => {
    const balance = accountBalance("LIABILITY", [
      { direction: "CREDIT", amount: 800 },
      { direction: "DEBIT", amount: 300 },
    ]);
    expect(balance).toBe(500);
  });

  it("computes a REVENUE account's natural credit balance", () => {
    const balance = accountBalance("REVENUE", [{ direction: "CREDIT", amount: 250 }]);
    expect(balance).toBe(250);
  });

  it("computes an EXPENSE account's natural debit balance", () => {
    const balance = accountBalance("EXPENSE", [{ direction: "DEBIT", amount: 120 }]);
    expect(balance).toBe(120);
  });

  it("returns zero for an account with no lines", () => {
    expect(accountBalance("ASSET", [])).toBe(0);
  });
});
