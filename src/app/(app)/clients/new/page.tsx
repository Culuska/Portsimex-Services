import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import ClientForm from "../ClientForm";
import { createClientAction } from "../actions";

export default async function NewClientPage() {
  await requirePermission("clients.manage");
  return (
    <div>
      <PageHeader title="New client" />
      <ClientForm action={createClientAction} submitLabel="Create client" />
    </div>
  );
}
