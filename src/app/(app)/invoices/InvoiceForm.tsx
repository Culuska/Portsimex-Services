"use client";

import { useActionState, useState } from "react";
import { createInvoiceAction } from "./actions";
import { convertQuoteToInvoiceAction } from "@/app/(app)/quotes/actions";

type LineItem = { description: string; quantity: string; unitPrice: string };

export default function InvoiceForm({
  clients,
  shipments,
  defaultShipmentId,
  inProcessQuotes = [],
}: {
  clients: { id: string; name: string }[];
  shipments: { id: string; reference: string; clientId: string }[];
  defaultShipmentId?: string;
  // Accepted-but-unbilled quotes for any client, offered as a one-click
  // alternative to building the invoice line-by-line once a client with
  // one is selected below.
  inProcessQuotes?: { id: string; quoteNumber: string; clientId: string; total: number }[];
}) {
  const [state, formAction, pending] = useActionState(createInvoiceAction, {
    error: null,
  });
  const [items, setItems] = useState<LineItem[]>([
    { description: "", quantity: "1", unitPrice: "" },
  ]);
  const [clientId, setClientId] = useState("");
  const clientShipments = clientId ? shipments.filter((s) => s.clientId === clientId) : shipments;
  const clientQuotes = inProcessQuotes.filter((q) => q.clientId === clientId);

  const total = items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0,
  );

  function updateItem(index: number, field: keyof LineItem, value: string) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  function addItem() {
    setItems((prev) => [...prev, { description: "", quantity: "1", unitPrice: "" }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const [defaultDueDate] = useState(() =>
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="clientId" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Client
          </label>
          <select
            id="clientId"
            name="clientId"
            required
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Select a client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="shipmentId" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Linked shipment (optional)
          </label>
          <select
            id="shipmentId"
            name="shipmentId"
            defaultValue={defaultShipmentId ?? ""}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">None</option>
            {clientShipments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.reference}
              </option>
            ))}
          </select>
          {clientId && clientShipments.length === 0 && (
            <p className="text-xs text-zinc-500">No shipments yet for this client.</p>
          )}
        </div>
      </div>

      {clientId && clientQuotes.length > 0 && (
        <div className="rounded-md border border-brand-200 dark:border-brand-900 bg-brand-50 dark:bg-brand-950 p-3">
          <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            This client has an accepted quote ready to invoice
          </p>
          <ul className="flex flex-col gap-2">
            {clientQuotes.map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {q.quoteNumber} —{" "}
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                    q.total,
                  )}
                </span>
                <form action={convertQuoteToInvoiceAction.bind(null, q.id)}>
                  <button
                    type="submit"
                    className="rounded-md border border-brand-300 dark:border-brand-800 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 dark:text-brand-300 dark:hover:bg-brand-900"
                  >
                    Use this quote instead
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="dueDate" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Due date
        </label>
        <input
          id="dueDate"
          name="dueDate"
          type="date"
          required
          defaultValue={defaultDueDate}
          className="w-fit rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Line items
        </p>
        <div className="flex flex-col gap-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                name="description[]"
                placeholder="Description"
                required
                value={item.description}
                onChange={(e) => updateItem(index, "description", e.target.value)}
                className="flex-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              />
              <input
                name="quantity[]"
                type="number"
                min="0"
                step="0.01"
                required
                value={item.quantity}
                onChange={(e) => updateItem(index, "quantity", e.target.value)}
                className="w-20 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              />
              <input
                name="unitPrice[]"
                type="number"
                min="0"
                step="0.01"
                required
                placeholder="Unit price"
                value={item.unitPrice}
                onChange={(e) => updateItem(index, "unitPrice", e.target.value)}
                className="w-28 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                type="button"
                onClick={() => removeItem(index)}
                disabled={items.length === 1}
                className="text-sm text-zinc-400 hover:text-red-600 disabled:opacity-30"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addItem}
          className="mt-2 text-sm text-brand-600 hover:underline"
        >
          + Add line item
        </button>
        <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Total: {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(total)}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 w-fit rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Create invoice"}
      </button>
    </form>
  );
}
