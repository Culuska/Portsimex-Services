import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canCreateDeliveryRecord } from "@/lib/permissions";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export default async function DeliveriesPage() {
  const session = await auth();
  if (!session || !canCreateDeliveryRecord(session.user.role)) {
    redirect("/");
  }

  const shipments = await prisma.shipment.findMany({
    where: { clearanceStatus: "CLEARED_FOR_DELIVERY", deliveryRecord: null },
    orderBy: { updatedAt: "desc" },
    include: { client: true },
  });

  return (
    <div>
      <PageHeader
        title="Deliveries"
        description="Shipments cleared by all ministries, awaiting a delivery record"
      />
      {shipments.length === 0 ? (
        <EmptyState message="Nothing waiting on a delivery record right now." />
      ) : (
        <Card className="p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Shipment</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {shipments.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/deliveries/${s.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {s.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{s.client.name}</td>
                  <td className="px-4 py-3 text-zinc-500">{s.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
