import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  consumeRecoveryCode,
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  hotp,
  otpauthUri,
  totp,
  verifyTotp,
} from "./totp";
import { checkPassword, LOGIN_RULES, rateLimit, sessionExpired } from "./security-rules";
import {
  ALL_PERMISSIONS,
  DEFAULT_PROFILES,
  LEGACY_STAFF_PERMISSIONS,
  canAccessJob,
  canApproveAmount,
  grantFor,
  hasPermission,
  isPermission,
} from "./permission-catalog";

describe("TOTP", () => {
  // RFC 4226 appendix D / RFC 6238 appendix B test vectors (secret "12345678901234567890").
  const rfcSecret = Buffer.from("12345678901234567890");
  it("matches the HOTP reference values", () => {
    expect([0, 1, 2, 9].map((c) => hotp(rfcSecret, c))).toEqual(["755224", "287082", "359152", "520489"]);
  });
  it("matches the TOTP reference values (8 digits)", () => {
    const b32 = base32Encode(rfcSecret);
    expect(totp(b32, 59_000, 30, 8)).toBe("94287082");
    expect(totp(b32, 1_111_111_109_000, 30, 8)).toBe("07081804");
    expect(totp(b32, 20_000_000_000_000, 30, 8)).toBe("65353130");
  });
  it("round-trips base32", () => {
    const bytes = Buffer.from([0, 1, 2, 250, 255, 7, 99]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
    expect(generateTotpSecret()).toMatch(/^[A-Z2-7]{32}$/);
  });
  it("accepts the current code and one step of clock drift, nothing else", () => {
    const secret = generateTotpSecret();
    const now = 1_790_000_000_000;
    expect(verifyTotp(secret, totp(secret, now), now)).toBe(true);
    expect(verifyTotp(secret, totp(secret, now - 30_000), now)).toBe(true);
    expect(verifyTotp(secret, totp(secret, now - 90_000), now)).toBe(false);
    expect(verifyTotp(secret, "12345", now)).toBe(false);
    expect(verifyTotp(secret, "abcdef", now)).toBe(false);
  });
  it("builds an authenticator-app link", () => {
    expect(otpauthUri("ABC", "amina@portsimex.com")).toBe(
      "otpauth://totp/Portsimex%20Services%3Aamina%40portsimex.com?secret=ABC&issuer=Portsimex%20Services&algorithm=SHA1&digits=6&period=30",
    );
  });
  it("encrypts the stored secret and detects tampering", () => {
    const enc = encryptSecret("JBSWY3DPEHPK3PXP", "server-key");
    expect(enc).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decryptSecret(enc, "server-key")).toBe("JBSWY3DPEHPK3PXP");
    expect(() => decryptSecret(enc, "other-key")).toThrow();
  });
  it("recovery codes are single use", () => {
    const { codes, hashes } = generateRecoveryCodes();
    expect(codes).toHaveLength(8);
    expect(hashes.join()).not.toContain(codes[0]);
    const left = consumeRecoveryCode(codes[0].toLowerCase(), hashes);
    expect(left).toHaveLength(7);
    expect(consumeRecoveryCode(codes[0], left!)).toBeNull();
  });
});

describe("password policy", () => {
  it("rejects short, letter-only, common and personal passwords", () => {
    expect(checkPassword("short1")).toMatch(/at least 10/);
    expect(checkPassword("onlyletterspassword")).toMatch(/letters and numbers/);
    expect(checkPassword("Password123")).toMatch(/too common/);
    expect(checkPassword("amina2026harbour", { email: "amina@portsimex.com" })).toMatch(/email/);
    expect(checkPassword("osman-2026-xyz", { name: "Osman Ulusow" })).toMatch(/name/);
    expect(checkPassword("harbour-lights-42")).toBeNull();
  });
});

describe("rate limiting", () => {
  const now = new Date("2026-10-07T10:00:00Z");
  const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000);
  it("locks after 5 failures in 15 minutes and says when to retry", () => {
    expect(rateLimit([1, 2, 3, 4].map(minsAgo), LOGIN_RULES.perAccount, now).allowed).toBe(true);
    const r = rateLimit([1, 2, 3, 4, 10].map(minsAgo), LOGIN_RULES.perAccount, now);
    expect(r.allowed).toBe(false);
    expect(Math.round(r.retryAfterMs / 60_000)).toBe(5);
  });
  it("forgets failures older than the window", () => {
    expect(rateLimit([16, 20, 30, 40, 50].map(minsAgo), LOGIN_RULES.perAccount, now).allowed).toBe(true);
  });
  it("ends sessions older than the configured lifetime", () => {
    expect(sessionExpired(now.getTime() - 13 * 3_600_000, 12, now.getTime())).toBe(true);
    expect(sessionExpired(now.getTime() - 11 * 3_600_000, 12, now.getTime())).toBe(false);
    expect(sessionExpired(undefined, 12, now.getTime())).toBe(false);
  });
});

describe("permissions", () => {
  const job = (category: string, responsibleId: string | null = null, taskAssigneeIds: string[] = []) => ({ category, responsibleId, taskAssigneeIds });
  const profile = (key: string) => {
    const p = DEFAULT_PROFILES.find((x) => x.key === key)!;
    return grantFor("STAFF", p);
  };

  it("Super Admins hold every permission; portal roles none", () => {
    expect(grantFor("ADMIN", null).permissions).toEqual(ALL_PERMISSIONS);
    expect(hasPermission(grantFor("SUPERVISOR", null), "finance.journal")).toBe(true);
    expect(grantFor("VENDOR", null).permissions).toEqual([]);
  });

  it("staff without a profile keep exactly what they could do before", () => {
    const g = grantFor("STAFF", null);
    expect(g.permissions).toEqual(LEGACY_STAFF_PERMISSIONS);
    expect(hasPermission(g, "users.manage")).toBe(false);
    expect(hasPermission(g, "invoices.manage")).toBe(true);
  });

  it("every default profile only uses known permissions", () => {
    for (const p of DEFAULT_PROFILES) for (const perm of p.permissions) expect(isPermission(perm)).toBe(true);
    expect(DEFAULT_PROFILES.map((p) => p.name)).toContain("Customs / Tax Officer");
  });

  it("officers only see jobs in their service lines", () => {
    const imm = profile("immigration-officer");
    expect(canAccessJob(imm, "u1", job("IMMIGRATION"))).toBe(true);
    expect(canAccessJob(imm, "u1", job("VEHICLE"))).toBe(false);
    expect(hasPermission(imm, "invoices.view")).toBe(false);
  });

  it("operations staff only see jobs assigned to them", () => {
    const staff = profile("operations-staff");
    expect(canAccessJob(staff, "u1", job("LOGISTICS", "u1"))).toBe(true);
    expect(canAccessJob(staff, "u1", job("LOGISTICS", "u2", ["u1"]))).toBe(true);
    expect(canAccessJob(staff, "u1", job("LOGISTICS", "u2", ["u3"]))).toBe(false);
  });

  it("viewers can look but not change anything", () => {
    const v = profile("viewer");
    expect(hasPermission(v, "jobs.view")).toBe(true);
    expect(v.permissions.some((p) => /manage|approve|create|pay|record|cancel/.test(p))).toBe(false);
  });

  it("approval limits cap what a profile may approve", () => {
    const ops = profile("operations-manager");
    expect(canApproveAmount(ops, 1500)).toBe(true);
    expect(canApproveAmount(ops, 2500)).toBe(false);
    expect(canApproveAmount(profile("finance-manager"), 1_000_000)).toBe(true);
    expect(canApproveAmount(profile("accountant"), 10)).toBe(false);
  });
});
