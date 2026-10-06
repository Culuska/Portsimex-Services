import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isFullAccessRole } from "@/lib/roles";
import { PageHeader } from "@/components/ui";
import AgencyForm from "../AgencyForm";
import { saveAgencyAction } from "../actions";

export default async function NewAgencyPage() {
  const session = await auth();
  if (!session || !isFullAccessRole(session.user.role)) redirect("/agencies");
  return (
    <div>
      <PageHeader title="New government agency" />
      <AgencyForm
        action={saveAgencyAction.bind(null, null)}
        defaults={{ name: "", department: "", office: "", contactName: "", contactPhone: "", contactEmail: "", location: "", services: "", referenceRequirements: "", notes: "", followUpDays: 7, active: true }}
      />
    </div>
  );
}
