import { auth } from "@/auth";
import { isFullAccessRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { activeServices } from "@/lib/catalog";
import { invoiceTotal } from "@/lib/invoices";
import { SERVICE_CATEGORY_LABELS } from "@/lib/service-templates";
import { PageHeader } from "@/components/ui";
import ServiceRequestForm from "../ServiceRequestForm";

export default async function NewServiceRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; quoteId?: string }>;
}) {
  const { clientId, quoteId } = await searchParams;
  const [session, clients, services, users, quote] = await Promise.all([
    auth(),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    activeServices(),
    prisma.user.findMany({
      where: { active: true, role: { in: ["ADMIN", "SUPERVISOR", "STAFF"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    quoteId ? prisma.quote.findUnique({ where: { id: quoteId }, include: { items: true } }) : null,
  ]);

  return (
    <div>
      <PageHeader
        title="New service request"
        description={`Every service starts here. A request number (SR-${new Date().getFullYear()}-NNNNN) is assigned automatically; once approved, each requested service opens its own job.`}
      />
      <ServiceRequestForm
        clients={clients}
        services={services.map((s) => ({ id: s.id, name: s.name, categoryLabel: SERVICE_CATEGORY_LABELS[s.category], slaDays: s.slaDays }))}
        users={users}
        canApprove={!!session && isFullAccessRole(session.user.role)}
        defaults={{
          clientId: quote?.clientId ?? clientId,
          quoteId: quote?.id,
          quoteNumber: quote?.quoteNumber,
          description: quote ? [`From quotation ${quote.quoteNumber}:`, ...quote.items.map((i) => `- ${i.description}`), quote.notes ?? ""].join("\n").trim() : undefined,
          estimatedRevenue: quote ? String(invoiceTotal(quote.items)) : undefined,
        }}
      />
    </div>
  );
}
