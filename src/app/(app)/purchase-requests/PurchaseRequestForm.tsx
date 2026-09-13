"use client";

import { useActionState } from "react";
import { createPurchaseRequestAction } from "./actions";

export default function PurchaseRequestForm({
  vendors,
  shipments,
  categories,
  defaultShipmentId,
}: {
  vendors: { id: string; name: string }[];
  shipments: { id: string; reference: string }[];
  categories: { id: string; name: string }[];
  defaultShipmentId?: string;
}) {
  const [state, formAction, pending] = useActionState(createPurchaseRequestAction, {
    error: null,
  });

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-lg">
      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          What do you need to buy?
        </label>
        <input
          id="description"
          name="description"
          required
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="amount" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Estimated amount
          </label>
          <input
            id="amount"
            name="amount"
            type="number"
            min="0"
            step="0.01"
            required
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="categoryName" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Category
          </label>
          <input
            id="categoryName"
            name="categoryName"
            list="category-options"
            required
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <datalist id="category-options">
            {categories.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="vendorId" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Vendor (optional)
          </label>
          <select
            id="vendorId"
            name="vendorId"
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">None</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="shipmentId" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Shipment (optional)
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
        <label htmlFor="notes" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Why this is needed, links to quotes, anything the approver should know."
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
        {pending ? "Submitting..." : "Submit request"}
      </button>
    </form>
  );
}
