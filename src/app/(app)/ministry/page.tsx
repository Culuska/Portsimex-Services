import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canActAsMinistryOfficer } from "@/lib/permissions";
import { isFullAccessRole } from "@/lib/roles";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";

export default async function MinistryQueuePage() {
  const session = await auth();
  if (!session || !canActAsMinistryOfficer(session.user.role)) {
    redirect("/");
  }

  const ministryId = session.user.ministryId;
  if (session.user.role === "MINISTRY_OFFICER" && !ministryId) {
    redirect("/");
  }

  const steps = await prisma.approvalStep.findMany({
    where: {
      status: "IN_REVIEW",
      ...(session.user.role === "MINISTRY_OFFICER" ? { ministryId: ministryId! } : {}),
    },
    orderBy: { startedAt: "asc" },
    include: { shipment: { include: { client: true } }, ministry: true },
  });

  return (
    <div>
      <PageHeader
        title="Ministry queue"
        description={
          isFullAccessRole(session.user.role)
            ? "All shipments currently awaiting review at any ministry"
            : "Shipments awaiting your review"
        }
      />
      {steps.length === 0 ? (
        <EmptyState message="Nothing waiting on review right now." />
      ) : (
        <Card className="p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Shipment</th>
                <th className="px-4 py-3 font-medium">Client</th>
                {isFullAccessRole(session.user.role) && (
                  <th className="px-4 py-3 font-medium">Ministry</th>
                )}
                <th className="px-4 py-3 font-medium">Waiting since</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {steps.map((step) => (
                <tr key={step.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/ministry/${step.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {step.shipment.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{step.shipment.client.name}</td>
                  {isFullAccessRole(session.user.role) && (
                    <td className="px-4 py-3 text-zinc-500">{step.ministry.name}</td>
                  )}
                  <td className="px-4 py-3 text-zinc-500">{formatDate(step.startedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
