import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessVendorPortal } from "@/lib/permissions";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

export default async function MyShipmentsPage() {
  const session = await auth();
  if (!session || !canAccessVendorPortal(session.user.role)) {
    redirect("/");
  }
  if (session.user.role === "VENDOR" && !session.user.vendorClientId) {
    redirect("/");
  }

  const shipments = await prisma.shipment.findMany({
    where:
      session.user.role === "VENDOR" ? { clientId: session.user.vendorClientId! } : {},
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="My shipments"
        description="Track your shipments through ministry document clearance"
      />
      {shipments.length === 0 ? (
        <EmptyState message="No shipments yet." />
      ) : (
        <Card className="p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Clearance status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {shipments.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/my-shipments/${s.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {s.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{s.type}</td>
                  <td className="px-4 py-3">
                    <Badge status={s.clearanceStatus} />
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
