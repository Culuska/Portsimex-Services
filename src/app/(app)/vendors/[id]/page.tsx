import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import VendorForm from "../VendorForm";
import { updateVendorAction } from "../actions";

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: {
      expenses: { orderBy: { incurredAt: "desc" }, include: { category: true } },
    },
  });

  if (!vendor) notFound();

  const boundUpdate = updateVendorAction.bind(null, vendor.id);

  return (
    <div>
      <PageHeader title={vendor.name} description="Vendor details" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
            Edit details
          </h2>
          <VendorForm
            action={boundUpdate}
            defaultValues={vendor}
            submitLabel="Save changes"
          />
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
            Expenses
          </h2>
          {vendor.expenses.length === 0 ? (
            <EmptyState message="No expenses recorded for this vendor." />
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
              {vendor.expenses.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2">
                  <div>
                    <Link
                      href={`/expenses/${e.id}`}
                      className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {e.description}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {e.category.name} · {formatDate(e.incurredAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      {formatCurrency(e.amount.toString())}
                    </span>
                    <Badge status={e.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
