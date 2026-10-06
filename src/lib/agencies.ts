import { prisma } from "@/lib/prisma";

// The first time the directory is opened, start it from the ministries
// already registered in the Tax Exemption Registry so nobody types them twice.
export async function ensureAgencies() {
  if ((await prisma.governmentAgency.count()) > 0) return;
  const ministries = await prisma.ministry.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  if (ministries.length === 0) return;
  await prisma.governmentAgency.createMany({
    data: ministries.map((m) => ({
      name: m.name,
      notes: m.description,
      referenceRequirements: m.requiredDocumentTypes.length ? `Required documents: ${m.requiredDocumentTypes.join(", ")}` : null,
    })),
  });
}

export async function activeAgencies() {
  await ensureAgencies();
  return prisma.governmentAgency.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}
