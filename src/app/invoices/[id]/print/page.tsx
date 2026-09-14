import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { SERVICE_TYPE_LABELS } from "@/lib/services";
import { formatCurrency } from "@/lib/format";
import { invoiceBalance, invoicePaid } from "@/lib/invoices";
import DocumentPreview from "@/components/DocumentPreview";

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { client: true, items: true, payments: true },
  });

  if (!invoice) notFound();

  const paid = invoicePaid(invoice.payments);
  const balance = invoiceBalance(invoice.items, invoice.payments);

  return (
    <div className="min-h-screen bg-zinc-100 py-8 print:bg-white print:py-0">
      <DocumentPreview
        docType="TAX INVOICE"
        number={invoice.invoiceNumber}
        issueDate={invoice.issueDate}
        secondDateLabel="Due date"
        secondDate={invoice.dueDate}
        clientName={invoice.client.name}
        clientAddress={invoice.client.address}
        clientEmail={invoice.client.email}
        items={invoice.items.map((item) => ({
          id: item.id,
          serviceLabel: item.serviceType ? SERVICE_TYPE_LABELS[item.serviceType] : null,
          description: item.description,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
        }))}
        notes={invoice.notes}
        extraTotals={
          paid > 0
            ? [
                { label: "Paid", value: formatCurrency(paid) },
                { label: "Balance due", value: formatCurrency(Math.max(balance, 0)) },
              ]
            : undefined
        }
      />
    </div>
  );
}
