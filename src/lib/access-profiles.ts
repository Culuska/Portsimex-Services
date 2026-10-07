import { prisma } from "@/lib/prisma";
import { DEFAULT_PROFILES } from "@/lib/permission-catalog";

// Creates the built-in job-title profiles the first time they're needed.
// Profiles an admin has since edited are never overwritten.
export async function ensureAccessProfiles() {
  const existing = await prisma.accessProfile.findMany({ select: { key: true, name: true } });
  const keys = new Set(existing.map((p) => p.key));
  const names = new Set(existing.map((p) => p.name));
  const missing = DEFAULT_PROFILES.filter((p) => !keys.has(p.key) && !names.has(p.name));
  if (missing.length === 0) return;
  await prisma.accessProfile.createMany({
    data: missing.map((p) => ({
      key: p.key,
      name: p.name,
      description: p.description,
      permissions: p.permissions,
      jobCategories: p.jobCategories,
      assignedJobsOnly: p.assignedJobsOnly,
      approvalLimit: p.approvalLimit,
    })),
    skipDuplicates: true,
  });
}
