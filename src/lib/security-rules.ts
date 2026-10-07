// Password policy and login rate limiting rules. Pure module (no app
// imports) so the rules are unit tested.

export const PASSWORD_MIN_LENGTH = 10;

const COMMON = new Set([
  "password",
  "password1",
  "password123",
  "passw0rd",
  "123456789",
  "1234567890",
  "qwerty123",
  "qwertyuiop",
  "letmein123",
  "welcome123",
  "admin12345",
  "iloveyou12",
  "portsimex",
  "portsimex1",
  "portsimex123",
  "somalia123",
  "mogadishu1",
]);

/** Null when acceptable, otherwise what's wrong with it. */
export function checkPassword(password: string, context: { email?: string; name?: string } = {}): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password.length > 200) return "That password is too long.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Use both letters and numbers.";
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return "That password is too common -- choose another.";
  if (/^(.)\1+$/.test(password)) return "That password is too easy to guess.";
  const local = context.email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) return "Don't use your email address in your password.";
  const first = context.name?.split(/\s+/)[0]?.toLowerCase();
  if (first && first.length >= 4 && lower.includes(first)) return "Don't use your name in your password.";
  return null;
}

export type RateRule = { limit: number; windowMs: number };

export const LOGIN_RULES = {
  /** Wrong passwords / codes for one account. */
  perAccount: { limit: 5, windowMs: 15 * 60_000 },
  /** Failed sign-ins from one network address (guessing many accounts). */
  perIp: { limit: 30, windowMs: 15 * 60_000 },
} satisfies Record<string, RateRule>;

export const RESET_RULES = {
  perAccount: { limit: 3, windowMs: 60 * 60_000 },
  perIp: { limit: 10, windowMs: 60 * 60_000 },
} satisfies Record<string, RateRule>;

/**
 * Given the times of recent events, whether another attempt is allowed now
 * and, if not, how long until the oldest one in the window expires.
 */
export function rateLimit(events: Date[], rule: RateRule, now = new Date()): { allowed: boolean; retryAfterMs: number } {
  const since = now.getTime() - rule.windowMs;
  const recent = events.map((d) => d.getTime()).filter((t) => t > since).sort((a, b) => a - b);
  if (recent.length < rule.limit) return { allowed: true, retryAfterMs: 0 };
  const oldestCounted = recent[recent.length - rule.limit];
  return { allowed: false, retryAfterMs: Math.max(oldestCounted + rule.windowMs - now.getTime(), 1000) };
}

export function minutesText(ms: number): string {
  const m = Math.ceil(ms / 60_000);
  return m <= 1 ? "a minute" : `${m} minutes`;
}

/** Absolute session lifetime: a sign-in older than this must sign in again. */
export function sessionExpired(loginAt: number | undefined, sessionHours: number, now = Date.now()): boolean {
  if (!loginAt) return false;
  return now - loginAt > sessionHours * 3_600_000;
}
