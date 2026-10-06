import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { isFullAccessRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { SUBMISSION_STATUS_LABELS } from "@/lib/submission-rules";
import { Badge, Card, PageHeader } from "@/components/ui";
import AgencyForm from "../AgencyForm";
import { saveAgencyAction } from "../actions";

export default async function AgencyPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !["ADMIN", "SUPERVISOR", "STAFF"].includes(session.user.role)) redirect("/");
  const { id } = await params;
  const agency = await prisma.governmentAgency.findUnique({
    where: { id },
    include: { submissions: { orderBy: { submittedAt: "desc" }, take: 50, include: { job: { include: { client: true } } } } },
  });
  if (!agency) notFound();
  const isManager = isFullAccessRole(session.user.role);
  return (
    <div>
      <PageHeader title={agency.name} description={[agency.department, agency.office, agency.location].filter(Boolean).join(" · ") || "Government agency"} action={<Badge status={agency.active ? "ACTIVE" : "INACTIVE"} />} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <AgencyForm
            action={saveAgencyAction.bind(null, agency.id)}
            readOnly={!isManager}
            defaults={{
              name: agency.name,
              department: agency.department ?? "",
              office: agency.office ?? "",
              contactName: agency.contactName ?? "",
              contactPhone: agency.contactPhone ?? "",
              contactEmail: agency.contactEmail ?? "",
              location: agency.location ?? "",
              services: agency.services ?? "",
              referenceRequirements: agency.referenceRequirements ?? "",
              notes: agency.notes ?? "",
              followUpDays: agency.followUpDays,
              active: agency.active,
            }}
          />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">Submissions</h2>
          {agency.submissions.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing submitted here yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
              {agency.submissions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div>
                    <Link href={`/jobs/${s.jobId}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">{s.job.jobNumber}</Link>
                    <p className="text-xs text-zinc-500">{s.job.client.name} · {formatDate(s.submittedAt)}{s.reference ? ` · ref ${s.reference}` : ""}</p>
                  </div>
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">{SUBMISSION_STATUS_LABELS[s.status]}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
