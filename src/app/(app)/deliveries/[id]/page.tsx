import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canCreateDeliveryRecord } from "@/lib/permissions";
import { Card, PageHeader } from "@/components/ui";
import { createDeliveryRecordAction } from "../../clearance/actions";
import DeliveryForm from "./DeliveryForm";

export default async function DeliveryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session || !canCreateDeliveryRecord(session.user.role)) {
    redirect("/");
  }

  const { id } = await params;
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: { client: true, deliveryRecord: true },
  });

  if (!shipment) notFound();

  const boundCreate = createDeliveryRecordAction.bind(null, shipment.id);

  return (
    <div>
      <PageHeader
        title={shipment.reference}
        description={`${shipment.client.name} · ${shipment.type}`}
      />
      <Card className="max-w-md">
        {shipment.deliveryRecord ? (
          <div>
            <h2 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-50">
              Delivery record created
            </h2>
            <p className="text-sm text-zinc-500">
              Mode: {shipment.deliveryRecord.deliveryMode} ·{" "}
              {shipment.deliveryRecord.destinationDetail}
            </p>
          </div>
        ) : shipment.clearanceStatus !== "CLEARED_FOR_DELIVERY" ? (
          <p className="text-sm text-zinc-500">
            This shipment isn&apos;t cleared for delivery yet.
          </p>
        ) : (
          <div>
            <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">
              Create delivery record
            </h2>
            <DeliveryForm action={boundCreate} />
          </div>
        )}
      </Card>
    </div>
  );
}
