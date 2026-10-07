import { cache } from "react";
import { prisma } from "@/lib/prisma";

export type Settings = {
  expenseApprovalThreshold: number;
  paymentAuthorizationThreshold: number;
  sessionHours: number;
  requireMfaForManagers: boolean;
};

/** Company-wide settings (approval limits, session length...), read once per request. */
export const getSettings = cache(async (): Promise<Settings> => {
  const s = await prisma.appSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
  return {
    expenseApprovalThreshold: Number(s.expenseApprovalThreshold),
    paymentAuthorizationThreshold: Number(s.paymentAuthorizationThreshold),
    sessionHours: s.sessionHours,
    requireMfaForManagers: s.requireMfaForManagers,
  };
});
