import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canManageMinistries } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import MinistryForm from "../MinistryForm";
import { createMinistryAction } from "../actions";

export default async function NewMinistryPage() {
  const session = await auth();
  if (!session || !canManageMinistries(session.user.role)) {
    redirect("/");
  }

  return (
    <div>
      <PageHeader title="New ministry" />
      <MinistryForm action={createMinistryAction} submitLabel="Create ministry" />
    </div>
  );
}
