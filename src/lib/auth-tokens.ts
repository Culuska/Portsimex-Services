import { prisma } from "@/lib/prisma";
import { hashLinkToken } from "@/lib/totp";

// Kept out of the "use server" action modules so it can never be called
// from the browser (it returns the account behind a token).
export async function findValidResetToken(token: string) {
  if (!token) return null;
  const row = await prisma.authToken.findUnique({ where: { tokenHash: hashLinkToken(token) }, include: { user: true } });
  if (!row || row.purpose !== "PASSWORD_RESET" || row.usedAt || row.expiresAt < new Date() || !row.user.active) return null;
  return row;
}

/** Marks the user's email verified if the token is valid. */
export async function consumeVerifyToken(token: string) {
  if (!token) return null;
  const row = await prisma.authToken.findUnique({ where: { tokenHash: hashLinkToken(token) }, include: { user: true } });
  if (!row || row.purpose !== "VERIFY_EMAIL" || row.usedAt || row.expiresAt < new Date()) return null;
  await prisma.$transaction([
    prisma.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } }),
  ]);
  return row.user;
}
