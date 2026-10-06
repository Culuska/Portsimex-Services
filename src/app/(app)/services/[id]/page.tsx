import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { isFullAccessRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import {
  documentsToLines,
  fieldsToLines,
  parseDocuments,
  parseFields,
  parseStages,
  parseTasks,
  stagesToLines,
  tasksToLines,
} from "@/lib/service-templates";
import { PageHeader } from "@/components/ui";
import ServiceForm from "../ServiceForm";
import { saveServiceAction } from "../actions";

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !isFullAccessRole(session.user.role)) redirect("/");
  const { id } = await params;
  const s = await prisma.serviceDefinition.findUnique({ where: { id } });
  if (!s) notFound();
  return (
    <div>
      <PageHeader title={s.name} description={`Service ${s.code} · jobs numbered JOB-${s.jobPrefix}-YYYY-NNNN`} />
      <ServiceForm
        action={saveServiceAction.bind(null, s.id)}
        defaults={{
          name: s.name,
          code: s.code,
          category: s.category,
          jobPrefix: s.jobPrefix,
          description: s.description ?? "",
          slaDays: s.slaDays === null ? "" : String(s.slaDays),
          active: s.active,
          reconcileQuantities: s.reconcileQuantities,
          stages: stagesToLines(parseStages(s.stages)),
          documents: documentsToLines(parseDocuments(s.documents)),
          tasks: tasksToLines(parseTasks(s.tasks)),
          fields: fieldsToLines(parseFields(s.fields)),
        }}
      />
    </div>
  );
}
