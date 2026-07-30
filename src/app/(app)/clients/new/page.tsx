import { PageHeader } from "@/components/ui";
import ClientForm from "../ClientForm";
import { createClientAction } from "../actions";

export default function NewClientPage() {
  return (
    <div>
      <PageHeader title="New client" />
      <ClientForm action={createClientAction} submitLabel="Create client" />
    </div>
  );
}
