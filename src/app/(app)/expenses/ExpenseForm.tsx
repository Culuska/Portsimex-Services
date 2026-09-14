"use client";

import { useActionState } from "react";

type ActionState = { error: string | null };
type ExpenseFormAction = (
  state: ActionState,
  formData: FormData,
) => Promise<ActionState>;

export default function ExpenseForm({
  action,
  vendors,
  shipments,
  categories,
  defaultValues,
  submitLabel,
}: {
  action: ExpenseFormAction;
  vendors: { id: string; name: string }[];
  shipments: { id: string; reference: string }[];
  categories: { id: string; name: string }[];
  defaultValues?: {
    description: string;
    amount: string;
    categoryName: string;
    vendorId: string | null;
    shipmentId: string | null;
    status: string;
    incurredAt: Date | string;
  };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  const incurredAtValue = defaultValues
    ? new Date(defaultValues.incurredAt).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-lg">
      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Description
        </label>
        <input
          id="description"
          name="description"
          required
          defaultValue={defaultValues?.description}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="amount" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Amount
          </label>
          <input
            id="amount"
            name="amount"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={defaultValues?.amount}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="incurredAt" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Date
          </label>
          <input
            id="incurredAt"
            name="incurredAt"
            type="date"
            required
            defaultValue={incurredAtValue}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
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
          defaultValue={defaultValues?.categoryName}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />
        <datalist id="category-options">
          {categories.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="vendorId" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Vendor (optional)
          </label>
          <select
            id="vendorId"
            name="vendorId"
            defaultValue={defaultValues?.vendorId ?? ""}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
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
            defaultValue={defaultValues?.shipmentId ?? ""}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
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
        <label htmlFor="status" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={defaultValues?.status ?? "PENDING"}
          className="w-fit rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
        </select>
      </div>

      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 w-fit rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
