import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import UserForm from "./UserForm";

export default async function NewUserPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    redirect("/");
  }

  const [ministries, clients] = await Promise.all([
    prisma.ministry.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div>
      <PageHeader title="New user" description="Invite a teammate to Portsimex" />
      <UserForm ministries={ministries} clients={clients} />
    </div>
  );
}
