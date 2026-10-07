import bcrypt from "bcryptjs";
import { CredentialsSignin } from "next-auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { LOGIN_RULES, rateLimit, type RateRule } from "@/lib/security-rules";
import { consumeRecoveryCode, decryptSecret, verifyTotp } from "@/lib/totp";

/** Why a sign-in failed; the code reaches the login form (never says which of email/password was wrong). */
export class LoginError extends CredentialsSignin {
  constructor(code: "invalid" | "locked" | "mfa_required" | "mfa_invalid") {
    super();
    this.code = code;
  }
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}

export function mfaKey(): string {
  const key = process.env.AUTH_SECRET;
  if (!key) throw new Error("AUTH_SECRET is not set");
  return key;
}

async function events(bucket: string, key: string, rule: RateRule) {
  const rows = await prisma.rateLimitEvent.findMany({
    where: { bucket, key, createdAt: { gt: new Date(Date.now() - rule.windowMs) } },
    select: { createdAt: true },
  });
  return rows.map((r) => r.createdAt);
}

export async function recordEvent(bucket: string, key: string) {
  await prisma.rateLimitEvent.create({ data: { bucket, key } });
}

/** How long until this email / address may try again (0 = allowed now). */
export async function loginLockout(email: string, ip: string): Promise<number> {
  const [acct, net] = await Promise.all([
    events("login-fail", email, LOGIN_RULES.perAccount),
    events("login-fail-ip", ip, LOGIN_RULES.perIp),
  ]);
  const a = rateLimit(acct, LOGIN_RULES.perAccount);
  const b = rateLimit(net, LOGIN_RULES.perIp);
  return Math.max(a.allowed ? 0 : a.retryAfterMs, b.allowed ? 0 : b.retryAfterMs);
}

async function fail(email: string, ip: string, code: "invalid" | "mfa_invalid"): Promise<never> {
  await prisma.rateLimitEvent.createMany({ data: [{ bucket: "login-fail", key: email }, { bucket: "login-fail-ip", key: ip }] });
  throw new LoginError(code);
}

// Compared against when the email doesn't exist, so a wrong email takes as
// long as a wrong password (no account enumeration by timing).
const DUMMY_HASH = "$2b$10$qX9q.HAxw7meGWCBxnVHfOL2CciqSG2hOtYPw3HVr8TAB6XhKl056";

/**
 * The single gate for every sign-in (the login form and any direct POST to
 * the auth endpoint both go through here): lockout after repeated failures,
 * password check, then the two-factor code when the account has one.
 */
export async function verifyLogin(input: { email: unknown; password: unknown; code: unknown; ip: string }) {
  if (typeof input.email !== "string" || typeof input.password !== "string") throw new LoginError("invalid");
  const email = input.email.trim().toLowerCase();
  const code = typeof input.code === "string" ? input.code.trim() : "";

  if ((await loginLockout(email, input.ip)) > 0) throw new LoginError("locked");

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid || !user.active) return fail(email, input.ip, "invalid");

  if (user.mfaEnabledAt && user.mfaSecret) {
    if (!code) throw new LoginError("mfa_required");
    let ok = false;
    try {
      ok = verifyTotp(decryptSecret(user.mfaSecret, mfaKey()), code);
    } catch {
      ok = false;
    }
    if (!ok) {
      const remaining = consumeRecoveryCode(code, user.mfaRecoveryCodes);
      if (remaining) {
        ok = true;
        await prisma.user.update({ where: { id: user.id }, data: { mfaRecoveryCodes: remaining } });
        await audit(prisma, user, {
          action: "MFA_RECOVERY_CODE_USED",
          module: "Security",
          entityType: "User",
          entityId: user.id,
          message: `${user.name} signed in with a recovery code (${remaining.length} left).`,
        });
      }
    }
    if (!ok) return fail(email, input.ip, "mfa_invalid");
  }

  await prisma.$transaction([
    prisma.rateLimitEvent.deleteMany({ where: { bucket: "login-fail", key: email } }),
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
  ]);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    ministryId: user.ministryId,
    vendorClientId: user.vendorClientId,
    sessionVersion: user.sessionVersion,
  };
}
