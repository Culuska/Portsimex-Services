import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import AgencyForm from "../AgencyForm";
import { saveAgencyAction } from "../actions";

export default async function NewAgencyPage() {
  await requirePermission("agencies.manage");
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
