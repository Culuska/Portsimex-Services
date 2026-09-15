import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessVendorPortal, canViewVendorShipment } from "@/lib/permissions";
import { Badge, Card, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";
import SimpleActionButton from "@/components/SimpleActionButton";
import { startClearanceAction, resubmitForReviewAction } from "../../clearance/actions";
import UploadForm from "./UploadForm";

export default async function MyShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session || !canAccessVendorPortal(session.user.role)) {
    redirect("/");
  }

  const { id } = await params;
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: {
      client: true,
      clearanceDocuments: { include: { versions: { orderBy: { version: "desc" } } } },
      approvalSteps: {
        orderBy: { position: "asc" },
        include: { ministry: true, actions: { orderBy: { createdAt: "asc" }, include: { actor: true } } },
      },
      deliveryRecord: true,
    },
  });

  if (!shipment) notFound();
  if (
    !canViewVendorShipment(
      { role: session.user.role, vendorClientId: session.user.vendorClientId },
      shipment.clientId,
    )
  ) {
    redirect("/my-shipments");
  }

  const correctionStep = shipment.approvalSteps.find((s) => s.status === "CORRECTION_REQUESTED");

  const chainDocTypes = [
    ...new Set(shipment.approvalSteps.flatMap((s) => s.ministry.requiredDocumentTypes)),
  ];

  const boundStart = startClearanceAction.bind(null, shipment.id);
  const boundResubmit = resubmitForReviewAction.bind(null, shipment.id);

  return (
    <div>
      <PageHeader
        title={shipment.reference}
        description={`${shipment.type} · ${shipment.origin} → ${shipment.destination}`}
        action={<Badge status={shipment.clearanceStatus} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          {shipment.clearanceStatus === "NOT_STARTED" && (
            <Card>
              <h2 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-50">
                Start clearance
              </h2>
              <p className="mb-3 text-sm text-zinc-500">
                Upload your documents below, then start the ministry approval process.
              </p>
              <SimpleActionButton action={boundStart} label="Start clearance" />
            </Card>
          )}

          <Card>
            <h2 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">Documents</h2>
            <UploadForm shipmentId={shipment.id} documentTypeOptions={chainDocTypes} />
            {shipment.clearanceDocuments.length > 0 && (
              <ul className="mt-4 flex flex-col gap-3 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                {shipment.clearanceDocuments.map((doc) => (
                  <li key={doc.id}>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {doc.documentType}
                    </p>
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {doc.versions.map((v) => (
                        <li key={v.id} className="text-xs text-zinc-500">
                          v{v.version} — {v.fileName} · {formatDate(v.createdAt)}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {correctionStep && (
            <Card className="border-amber-300 dark:border-amber-800">
              <h2 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-50">
                Correction requested by {correctionStep.ministry.name}
              </h2>
              <p className="mb-3 text-sm text-zinc-500">
                Upload the corrected document above, then resubmit for review.
              </p>
              <SimpleActionButton action={boundResubmit} label="Resubmit for review" />
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
              Ministry timeline
            </h2>
            {shipment.approvalSteps.length === 0 ? (
              <p className="text-sm text-zinc-500">Clearance hasn&apos;t started yet.</p>
            ) : (
              <ol className="flex flex-col gap-4">
                {shipment.approvalSteps.map((step) => (
                  <li key={step.id} className="border-l-2 border-zinc-200 dark:border-zinc-800 pl-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {step.position}. {step.ministry.name}
                      </p>
                      <Badge status={step.status} />
                    </div>
                    {step.actions.length > 0 && (
                      <ul className="mt-1 flex flex-col gap-1">
                        {step.actions.map((a) => (
                          <li key={a.id} className="text-xs text-zinc-500">
                            <span className="font-medium">{a.action.replace(/_/g, " ")}</span> by{" "}
                            {a.actor.name} · {formatDate(a.createdAt)}
                            <br />
                            {a.note}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {shipment.deliveryRecord && (
            <Card>
              <h2 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-50">Delivery</h2>
              <p className="text-sm text-zinc-500">
                Mode: {shipment.deliveryRecord.deliveryMode} ·{" "}
                {shipment.deliveryRecord.destinationDetail}
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
