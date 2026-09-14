"use client";

import { useActionState, useState } from "react";
import { createQuoteAction } from "./actions";

type LineItem = {
  description: string;
  quantity: string;
  unitPrice: string;
  purchaseRequestId?: string;
};

export default function QuoteForm({
  clients,
  shipments,
  purchaseRequests,
  defaultShipmentId,
}: {
  clients: { id: string; name: string; markupPercent: string }[];
  shipments: { id: string; reference: string; clientId: string }[];
  purchaseRequests: { id: string; description: string; amount: string; clientId: string }[];
  defaultShipmentId?: string;
}) {
  const [state, formAction, pending] = useActionState(createQuoteAction, {
    error: null,
  });
  const [items, setItems] = useState<LineItem[]>([
    { description: "", quantity: "1", unitPrice: "" },
  ]);
  const [clientId, setClientId] = useState("");

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

  const selectedClient = clients.find((c) => c.id === clientId);
  const linkedPurchaseRequestIds = new Set(
    items.map((i) => i.purchaseRequestId).filter((id): id is string => Boolean(id)),
  );
  const availablePurchaseRequests = purchaseRequests.filter(
    (pr) => pr.clientId === clientId && !linkedPurchaseRequestIds.has(pr.id),
  );

  function addPurchaseRequest(pr: { id: string; description: string; amount: string }) {
    const markupPercent = Number(selectedClient?.markupPercent ?? 0);
    const billable = Number(pr.amount) * (1 + markupPercent / 100);
    setItems((prev) => {
      const blank = prev.length === 1 && !prev[0].description ? prev.slice(1) : prev;
      return [
        ...blank,
        {
          description: pr.description,
          quantity: "1",
          unitPrice: billable.toFixed(2),
          purchaseRequestId: pr.id,
        },
      ];
    });
  }

  const [defaultExpiryDate] = useState(() =>
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
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
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
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">None</option>
            {shipments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.reference}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="expiryDate" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Valid until
        </label>
        <input
          id="expiryDate"
          name="expiryDate"
          type="date"
          defaultValue={defaultExpiryDate}
          className="w-fit rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {clientId && availablePurchaseRequests.length > 0 && (
        <div className="rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950 p-3">
          <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Approved purchase requests for this client
          </p>
          <ul className="flex flex-col gap-2">
            {availablePurchaseRequests.map((pr) => {
              const markupPercent = Number(selectedClient?.markupPercent ?? 0);
              const billable = Number(pr.amount) * (1 + markupPercent / 100);
              return (
                <li key={pr.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {pr.description} —{" "}
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                      billable,
                    )}{" "}
                    <span className="text-zinc-500">
                      (cost {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(pr.amount))} + {markupPercent}%)
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => addPurchaseRequest(pr)}
                    className="shrink-0 rounded-md border border-blue-300 dark:border-blue-800 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900"
                  >
                    + Add to quote
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Line items
        </p>
        <div className="flex flex-col gap-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <input type="hidden" name="purchaseRequestId[]" value={item.purchaseRequestId ?? ""} />
              <input
                name="description[]"
                placeholder="Description"
                required
                value={item.description}
                onChange={(e) => updateItem(index, "description", e.target.value)}
                className="flex-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                name="quantity[]"
                type="number"
                min="0"
                step="0.01"
                required
                value={item.quantity}
                onChange={(e) => updateItem(index, "quantity", e.target.value)}
                className="w-20 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-28 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
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
          className="mt-2 text-sm text-blue-600 hover:underline"
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
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 w-fit rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Create quote"}
      </button>
    </form>
  );
}
