import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import QuoteForm from "../QuoteForm";

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ shipmentId?: string }>;
}) {
  const { shipmentId } = await searchParams;
  const [clients, shipments, purchaseRequests] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, markupPercent: true },
    }),
    prisma.shipment.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, reference: true, clientId: true },
    }),
    prisma.purchaseRequest.findMany({
      where: { status: "APPROVED", clientId: { not: null }, quoteItem: null },
      select: { id: true, description: true, amount: true, clientId: true, serviceType: true },
    }),
  ]);

  return (
    <div>
      <PageHeader title="New quote" />
      <QuoteForm
        clients={clients.map((c) => ({ ...c, markupPercent: c.markupPercent.toString() }))}
        shipments={shipments}
        purchaseRequests={purchaseRequests.map((pr) => ({
          ...pr,
          amount: pr.amount.toString(),
          clientId: pr.clientId!,
        }))}
        defaultShipmentId={shipmentId}
      />
    </div>
  );
}
