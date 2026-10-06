import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isFullAccessRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { ensureAgencies } from "@/lib/agencies";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";

export default async function AgenciesPage() {
  const session = await auth();
  if (!session || !["ADMIN", "SUPERVISOR", "STAFF"].includes(session.user.role)) redirect("/");
  await ensureAgencies();
  const agencies = await prisma.governmentAgency.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { submissions: true } }, submissions: { where: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUIRED"] } }, select: { id: true } } },
  });
  return (
    <div>
      <PageHeader
        title="Government Agencies"
        description="Ministries, departments and offices that cases are submitted to"
        action={isFullAccessRole(session.user.role) ? <ButtonLink href="/agencies/new">New agency</ButtonLink> : undefined}
      />
      {agencies.length === 0 ? (
        <EmptyState message="No agencies yet." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3 font-medium">Agency</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Services</th>
                <th className="px-4 py-3 text-right font-medium">Open submissions</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {agencies.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3">
                    <Link href={`/agencies/${a.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">{a.name}</Link>
                    <p className="text-xs text-zinc-500">{[a.department, a.office, a.location].filter(Boolean).join(" · ")}</p>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{[a.contactName, a.contactPhone].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-4 py-3 text-zinc-500">{a.services ?? "—"}</td>
                  <td className="px-4 py-3 text-right">{a.submissions.length} <span className="text-xs text-zinc-400">of {a._count.submissions}</span></td>
                  <td className="px-4 py-3"><Badge status={a.active ? "ACTIVE" : "INACTIVE"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
