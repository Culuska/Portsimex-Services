import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageMinistries } from "@/lib/permissions";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";

export default async function MinistriesPage() {
  const session = await auth();
  if (!session || !canManageMinistries(session.user.role)) {
    redirect("/");
  }

  const ministries = await prisma.ministry.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <PageHeader
        title="Ministries"
        description="Register ministries and configure their approval chain position"
        action={
          <div className="flex gap-3">
            <Link
              href="/ministries/chains"
              className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Configure chains
            </Link>
            <ButtonLink href="/ministries/new">New ministry</ButtonLink>
          </div>
        }
      />
      {ministries.length === 0 ? (
        <EmptyState message="No ministries registered yet." />
      ) : (
        <Card className="p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Required documents</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {ministries.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/ministries/${m.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {m.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{m.code}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {m.requiredDocumentTypes.length > 0
                      ? m.requiredDocumentTypes.join(", ")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {m.active ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                        Inactive
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
