import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import ShipmentForm from "../ShipmentForm";
import { createShipmentAction } from "../actions";

export default async function NewShipmentPage() {
  const [clients, users] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div>
      <PageHeader title="New shipment" description="Create an operational job" />
      <ShipmentForm
        action={createShipmentAction}
        clients={clients}
        users={users}
        submitLabel="Create shipment"
      />
    </div>
  );
}
