import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";

export default async function VendorsPage() {
  const vendors = await prisma.vendor.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { expenses: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Vendors"
        description="Subcontractors and suppliers you pay for services"
        action={<ButtonLink href="/vendors/new">New vendor</ButtonLink>}
      />
      {vendors.length === 0 ? (
        <EmptyState message="No vendors yet. Add your first vendor to get started." />
      ) : (
        <Card className="p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Expenses</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {vendors.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/vendors/${v.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {v.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{v.service || "—"}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {v.email || v.phone || "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{v._count.expenses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
