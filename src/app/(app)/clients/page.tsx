import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { shipments: true, invoices: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Companies you provide freight and port services for"
        action={<ButtonLink href="/clients/new">New client</ButtonLink>}
      />
      {clients.length === 0 ? (
        <EmptyState message="No clients yet. Add your first client to get started." />
      ) : (
        <Card className="p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Shipments</th>
                <th className="px-4 py-3 font-medium">Invoices</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/clients/${c.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={c.stage} />
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {c.email || c.phone || "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{c._count.shipments}</td>
                  <td className="px-4 py-3 text-zinc-500">{c._count.invoices}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
