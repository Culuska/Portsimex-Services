import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import VendorForm from "../VendorForm";
import { createVendorAction } from "../actions";

export default async function NewVendorPage() {
  await requirePermission("vendors.manage");
  return (
    <div>
      <PageHeader title="New vendor" />
      <VendorForm action={createVendorAction} submitLabel="Create vendor" />
    </div>
  );
}
