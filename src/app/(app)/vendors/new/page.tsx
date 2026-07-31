import { PageHeader } from "@/components/ui";
import VendorForm from "../VendorForm";
import { createVendorAction } from "../actions";

export default function NewVendorPage() {
  return (
    <div>
      <PageHeader title="New vendor" />
      <VendorForm action={createVendorAction} submitLabel="Create vendor" />
    </div>
  );
}
