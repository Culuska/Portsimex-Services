import Link from "next/link";
import { auth } from "@/auth";
import { isFullAccessRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { EmptyState, PageHeader } from "@/components/ui";
import ShipmentForm from "../ShipmentForm";
import { createShipmentAction } from "../actions";

export default async function NewShipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ quoteId?: string }>;
}) {
  const [session, { quoteId }] = await Promise.all([auth(), searchParams]);

  const quote = quoteId
    ? await prisma.quote.findUnique({ where: { id: quoteId }, include: { client: true } })
    : null;

  // A shipment only exists once a client has accepted a quote -- there is
  // no standalone "create a shipment from scratch" path anymore.
  if (!quote || quote.status !== "ACCEPTED" || quote.shipmentId) {
    return (
      <div>
        <PageHeader title="New shipment" />
        <EmptyState
          message={
            quote?.shipmentId
              ? "This quote already has a shipment."
              : "Shipments are created from an accepted quote. Open an accepted quote and use \"Start shipment\" there."
          }
        />
        <Link
          href="/quotes"
          className="mt-4 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400"
        >
          Go to Quotes
        </Link>
      </div>
    );
  }

  // Client acceptance alone isn't enough to commit to the job -- only an
  // admin can actually start the shipment (see createShipmentAction).
  if (!session || !isFullAccessRole(session.user.role)) {
    return (
      <div>
        <PageHeader title="New shipment" />
        <EmptyState message="Only an admin can start a shipment from an accepted quote." />
        <Link
          href={`/quotes/${quote.id}`}
          className="mt-4 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400"
        >
          Back to {quote.quoteNumber}
        </Link>
      </div>
    );
  }

  const users = await prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  return (
    <div>
      <PageHeader title="New shipment" description="Create the operational job for this quote" />
      <ShipmentForm
        action={createShipmentAction}
        clients={[]}
        users={users}
        submitLabel="Create shipment"
        fromQuote={{
          id: quote.id,
          quoteNumber: quote.quoteNumber,
          clientId: quote.clientId,
          clientName: quote.client.name,
          type: quote.type,
        }}
      />
    </div>
  );
}
