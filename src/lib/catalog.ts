import { prisma } from "@/lib/prisma";
import { DEFAULT_SERVICE_CATALOG } from "@/lib/service-templates";

// Seeds the default service catalog the first time it's needed (empty
// table only), so production gets it without a manual step. After that
// the database is the source of truth: admins add, edit and deactivate
// services from the Service Catalog page.
export async function ensureServiceCatalog() {
  const count = await prisma.serviceDefinition.count();
  if (count > 0) return;
  await prisma.serviceDefinition.createMany({
    data: DEFAULT_SERVICE_CATALOG.map((s, i) => ({
      code: s.code,
      name: s.name,
      category: s.category,
      jobPrefix: s.jobPrefix,
      description: s.description ?? null,
      slaDays: s.slaDays,
      sortOrder: i,
      stages: s.stages,
      documents: s.documents,
      tasks: s.tasks,
      fields: s.fields,
      reconcileQuantities: s.reconcileQuantities ?? false,
    })),
    skipDuplicates: true,
  });
}

export async function activeServices() {
  await ensureServiceCatalog();
  return prisma.serviceDefinition.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
}
