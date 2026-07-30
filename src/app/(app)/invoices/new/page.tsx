import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import InvoiceForm from "../InvoiceForm";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ shipmentId?: string }>;
}) {
  const { shipmentId } = await searchParams;
  const [clients, shipments] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.shipment.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, reference: true, clientId: true },
    }),
  ]);

  return (
    <div>
      <PageHeader title="New invoice" />
      <InvoiceForm clients={clients} shipments={shipments} defaultShipmentId={shipmentId} />
    </div>
  );
}
