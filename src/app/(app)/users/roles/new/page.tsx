import Link from "next/link";
import { requirePermission } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import ProfileForm from "../ProfileForm";
import { saveProfileAction } from "../actions";

export default async function NewRolePage() {
  await requirePermission("users.manage");
  return (
    <div>
      <PageHeader title="New role" description="A job title and what it is allowed to do" />
      <Card className="max-w-4xl">
        <ProfileForm action={saveProfileAction.bind(null, null)} submitLabel="Create role" />
      </Card>
      <Link href="/users/roles" className="mt-4 inline-block text-sm text-brand-600 hover:underline">
        ← Roles
      </Link>
    </div>
  );
}
