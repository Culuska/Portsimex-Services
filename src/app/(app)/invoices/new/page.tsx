import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import InvoiceForm from "../InvoiceForm";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ shipmentId?: string }>;
}) {
  const { shipmentId } = await searchParams;
  const [clients, shipments, inProcessQuotes] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.shipment.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, reference: true, clientId: true },
    }),
    // Accepted quotes not yet converted to an invoice -- offered as a
    // one-click alternative to building the invoice from scratch (see
    // convertQuoteToInvoiceAction, reused as-is below).
    prisma.quote.findMany({
      where: { status: "ACCEPTED", invoice: null },
      include: { items: true },
      orderBy: { issueDate: "desc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="New invoice"
        description={`An invoice number (INV-${new Date().getFullYear()}-XXXX) is assigned automatically when you save -- no need to enter one.`}
      />
      <InvoiceForm
        clients={clients}
        shipments={shipments}
        defaultShipmentId={shipmentId}
        inProcessQuotes={inProcessQuotes.map((q) => ({
          id: q.id,
          quoteNumber: q.quoteNumber,
          clientId: q.clientId,
          total: q.items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unitPrice), 0),
        }))}
      />
    </div>
  );
}
