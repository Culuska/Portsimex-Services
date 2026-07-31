import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";
import ClientForm from "../ClientForm";
import { updateClientAction } from "../actions";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      shipments: { orderBy: { createdAt: "desc" } },
      invoices: { orderBy: { issueDate: "desc" } },
    },
  });

  if (!client) notFound();

  const boundUpdate = updateClientAction.bind(null, client.id);

  return (
    <div>
      <PageHeader title={client.name} description="Client details" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
            Edit details
          </h2>
          <ClientForm
            action={boundUpdate}
            defaultValues={client}
            submitLabel="Save changes"
          />
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
              Shipments
            </h2>
            {client.shipments.length === 0 ? (
              <EmptyState message="No shipments for this client." />
            ) : (
              <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
                {client.shipments.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2">
                    <Link
                      href={`/shipments/${s.id}`}
                      className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {s.reference}
                    </Link>
                    <Badge status={s.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
              Invoices
            </h2>
            {client.invoices.length === 0 ? (
              <EmptyState message="No invoices for this client." />
            ) : (
              <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
                {client.invoices.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between py-2">
                    <div>
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                      >
                        {inv.invoiceNumber}
                      </Link>
                      <p className="text-xs text-zinc-500">
                        due {formatDate(inv.dueDate)}
                      </p>
                    </div>
                    <Badge status={inv.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
