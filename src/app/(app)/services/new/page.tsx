import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import ServiceForm from "../ServiceForm";
import { saveServiceAction } from "../actions";

export default async function NewServicePage() {
  await requirePermission("catalog.manage");
  return (
    <div>
      <PageHeader title="New service" description="Add a service to the catalog -- no database changes needed" />
      <ServiceForm
        action={saveServiceAction.bind(null, null)}
        defaults={{
          name: "",
          code: "",
          category: "OTHER",
          jobPrefix: "",
          description: "",
          slaDays: "",
          active: true,
          reconcileQuantities: false,
          stages: "Request review\nDocument collection | docs\nProcessing\nCompletion",
          documents: "Client documents\nCompletion document | output",
          tasks: "Review request | 1\nComplete and confirm with client",
          fields: "reference | External reference | text",
        }}
      />
    </div>
  );
}
