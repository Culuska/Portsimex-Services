import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import PurchaseRequestForm from "../PurchaseRequestForm";

export default async function NewPurchaseRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ shipmentId?: string }>;
}) {
  const { shipmentId } = await searchParams;
  const [vendors, shipments, categories, clients] = await Promise.all([
    prisma.vendor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.shipment.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, reference: true },
    }),
    prisma.expenseCategory.findMany({ orderBy: { name: "asc" } }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div>
      <PageHeader
        title="New purchase request"
        description={`A request number (PR-${new Date().getFullYear()}-XXXX) is assigned automatically when you save -- no need to enter one.`}
      />
      <PurchaseRequestForm
        vendors={vendors}
        shipments={shipments}
        categories={categories}
        clients={clients}
        defaultShipmentId={shipmentId}
      />
    </div>
  );
}
