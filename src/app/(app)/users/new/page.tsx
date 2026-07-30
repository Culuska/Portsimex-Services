import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/ui";
import UserForm from "./UserForm";

export default async function NewUserPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <div>
      <PageHeader title="New user" description="Invite a teammate to Portsimex" />
      <UserForm />
    </div>
  );
}
