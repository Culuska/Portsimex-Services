import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { SERVICE_TYPE_LABELS } from "@/lib/services";
import DocumentPreview from "@/components/DocumentPreview";

export default async function QuotePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { client: true, items: true },
  });

  if (!quote) notFound();

  return (
    <div className="min-h-screen bg-zinc-100 py-8 print:bg-white print:py-0">
      <DocumentPreview
        docType="QUOTATION"
        number={quote.quoteNumber}
        issueDate={quote.issueDate}
        secondDateLabel="Valid until"
        secondDate={quote.expiryDate}
        clientName={quote.client.name}
        clientAddress={quote.client.address}
        clientEmail={quote.client.email}
        items={quote.items.map((item) => ({
          id: item.id,
          serviceLabel: item.serviceType ? SERVICE_TYPE_LABELS[item.serviceType] : null,
          description: item.description,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
        }))}
        notes={quote.notes}
      />
    </div>
  );
}
