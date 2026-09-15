import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canActAsMinistryOfficer } from "@/lib/permissions";
import { Card, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { takeApprovalActionAction } from "../../clearance/actions";
import ActionForm from "./ActionForm";

export default async function MinistryStepPage({
  params,
}: {
  params: Promise<{ stepId: string }>;
}) {
  const session = await auth();
  if (!session || !canActAsMinistryOfficer(session.user.role)) {
    redirect("/");
  }

  const { stepId } = await params;
  const step = await prisma.approvalStep.findUnique({
    where: { id: stepId },
    include: {
      ministry: true,
      shipment: {
        include: {
          client: true,
          clearanceDocuments: {
            include: { versions: { orderBy: { version: "desc" } } },
          },
        },
      },
      actions: { orderBy: { createdAt: "asc" }, include: { actor: true } },
    },
  });

  if (!step) notFound();

  if (session.user.role === "MINISTRY_OFFICER" && step.ministryId !== session.user.ministryId) {
    redirect("/ministry");
  }

  const boundAction = takeApprovalActionAction.bind(null, step.id);
  const canAct = step.status === "IN_REVIEW";

  return (
    <div>
      <PageHeader
        title={step.shipment.reference}
        description={`${step.shipment.client.name} · ${step.ministry.name}`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">Documents</h2>
          {step.ministry.requiredDocumentTypes.length > 0 && (
            <p className="mb-3 text-xs text-zinc-500">
              Required: {step.ministry.requiredDocumentTypes.join(", ")}
            </p>
          )}
          {step.shipment.clearanceDocuments.length === 0 ? (
            <p className="text-sm text-zinc-500">No documents uploaded yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {step.shipment.clearanceDocuments.map((doc) => (
                <li key={doc.id}>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {doc.documentType}
                  </p>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {doc.versions.map((v) => (
                      <li key={v.id} className="text-xs text-zinc-500">
                        <a
                          href={v.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-700 hover:underline dark:text-brand-300"
                        >
                          v{v.version} — {v.fileName}
                        </a>{" "}
                        · {formatDate(v.createdAt)}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          {canAct ? (
            <Card>
              <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">Decision</h2>
              <ActionForm action={boundAction} />
            </Card>
          ) : (
            <Card>
              <p className="text-sm text-zinc-500">
                This step is {step.status.replace(/_/g, " ").toLowerCase()} — no action needed.
              </p>
            </Card>
          )}

          <Card>
            <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">
              Action history
            </h2>
            {step.actions.length === 0 ? (
              <p className="text-sm text-zinc-500">No actions taken yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
                {step.actions.map((a) => (
                  <li key={a.id} className="py-2 text-sm">
                    <p className="text-zinc-900 dark:text-zinc-50">
                      <span className="font-medium">{a.action.replace(/_/g, " ")}</span> ·{" "}
                      {a.actor.name} · {formatDate(a.createdAt)}
                    </p>
                    <p className="text-zinc-500">{a.note}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Link
            href={`/shipments/${step.shipment.id}`}
            className="text-sm text-brand-700 hover:underline dark:text-brand-300"
          >
            View full shipment timeline →
          </Link>
        </div>
      </div>
    </div>
  );
}
