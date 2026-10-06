import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isFullAccessRole } from "@/lib/roles";
import { PageHeader } from "@/components/ui";
import ServiceForm from "../ServiceForm";
import { saveServiceAction } from "../actions";

export default async function NewServicePage() {
  const session = await auth();
  if (!session || !isFullAccessRole(session.user.role)) redirect("/");
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
