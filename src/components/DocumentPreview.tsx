import { COMPANY } from "@/lib/company";
import { formatCurrency, formatDate } from "@/lib/format";
import PrintButton from "./PrintButton";

type DocumentItem = {
  id: string;
  serviceLabel: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
};

export default function DocumentPreview({
  docType,
  number,
  issueDate,
  secondDateLabel,
  secondDate,
  clientName,
  clientAddress,
  clientEmail,
  items,
  notes,
  extraTotals,
}: {
  docType: "TAX INVOICE" | "QUOTATION";
  number: string;
  issueDate: Date | string;
  secondDateLabel: string;
  secondDate: Date | string | null;
  clientName: string;
  clientAddress: string | null;
  clientEmail: string | null;
  items: DocumentItem[];
  notes: string | null;
  extraTotals?: { label: string; value: string }[];
}) {
  const total = items.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
    0,
  );
  const isInvoice = docType === "TAX INVOICE";
  const ribbonColor = isInvoice ? "bg-brand-800" : "bg-accent-700";

  return (
    <div className="mx-auto max-w-3xl bg-white text-zinc-900 print:max-w-none">
      <PrintButton />

      <div className="border border-zinc-200 print:border-0">
        <div className="flex items-start justify-between bg-brand-800 px-8 py-6 text-white">
          <div>
            <p className="text-xl font-bold tracking-tight">
              Portsimex <span className="text-accent-300">Services</span>
            </p>
            <p className="text-xs text-brand-200">{COMPANY.tagline}</p>
          </div>
          <div className={`rounded px-4 py-2 text-right ${ribbonColor}`}>
            <p className="text-sm font-semibold uppercase tracking-wide">{docType}</p>
          </div>
        </div>

        <div className="flex items-start justify-between px-8 pt-6 text-sm">
          <div>
            <p className="font-semibold text-zinc-900">{COMPANY.name}</p>
            <p className="text-zinc-500">{COMPANY.address}</p>
            <p className="text-zinc-500">{COMPANY.email}</p>
            <p className="text-zinc-500">{COMPANY.phone}</p>
          </div>
          <div className="text-right">
            <p className="text-zinc-500">
              {isInvoice ? "Invoice No." : "Quotation No."}{" "}
              <span className="font-medium text-zinc-900">{number}</span>
            </p>
            <p className="text-zinc-500">
              Date <span className="font-medium text-zinc-900">{formatDate(issueDate)}</span>
            </p>
            {secondDate && (
              <p className="text-zinc-500">
                {secondDateLabel}{" "}
                <span className="font-medium text-zinc-900">{formatDate(secondDate)}</span>
              </p>
            )}
          </div>
        </div>

        <div className="px-8 pt-6 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            {isInvoice ? "Bill to" : "To"}
          </p>
          <p className="font-semibold text-zinc-900">{clientName}</p>
          {clientAddress && <p className="text-zinc-500">{clientAddress}</p>}
          {clientEmail && <p className="text-zinc-500">{clientEmail}</p>}
        </div>

        <div className="px-8 pt-6">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b-2 border-brand-800 text-zinc-500">
                <th className="py-2 font-medium">#</th>
                <th className="py-2 font-medium">Service</th>
                <th className="py-2 font-medium">Description</th>
                <th className="py-2 text-right font-medium">Qty</th>
                <th className="py-2 text-right font-medium">Unit price</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {items.map((item, i) => (
                <tr key={item.id}>
                  <td className="py-2 text-zinc-400">{i + 1}</td>
                  <td className="py-2 text-zinc-500">{item.serviceLabel ?? "—"}</td>
                  <td className="py-2">{item.description}</td>
                  <td className="py-2 text-right">{item.quantity}</td>
                  <td className="py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-2 text-right">
                    {formatCurrency(Number(item.quantity) * Number(item.unitPrice))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex justify-end">
            <div className="w-64">
              <div className="flex justify-between border-t border-zinc-200 py-1.5 text-sm text-zinc-500">
                <span>Subtotal</span>
                <span>{formatCurrency(total)}</span>
              </div>
              <div className="flex justify-between bg-brand-800 px-3 py-2 text-sm font-semibold text-white">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
              {extraTotals?.map((row) => (
                <div
                  key={row.label}
                  className="flex justify-between py-1.5 text-sm text-zinc-500"
                >
                  <span>{row.label}</span>
                  <span>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {notes && (
            <p className="mt-6 border-t border-zinc-100 pt-4 text-sm text-zinc-500">{notes}</p>
          )}

          <p className="mt-8 text-sm text-zinc-500">
            {isInvoice
              ? "Thank you for your business!"
              : "We look forward to doing business with you!"}
          </p>
          <p className="mt-1 text-sm font-semibold italic text-brand-800">{COMPANY.name}</p>
        </div>

        <div className="mt-8 flex items-center justify-between bg-accent-700 px-8 py-3 text-xs text-white">
          <span>{COMPANY.phone}</span>
          <span>{COMPANY.email}</span>
          <span>{COMPANY.address}</span>
        </div>
      </div>
    </div>
  );
}
