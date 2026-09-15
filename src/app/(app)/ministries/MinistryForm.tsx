"use client";

import { useActionState } from "react";

type ActionState = { error: string | null };
type MinistryFormAction = (
  state: ActionState,
  formData: FormData,
) => Promise<ActionState>;

export default function MinistryForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: MinistryFormAction;
  defaultValues?: {
    name: string;
    code: string;
    description: string | null;
    active: boolean;
    defaultPosition: number | null;
    requiredDocumentTypes: string[];
  };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-lg">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Ministry name
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={defaultValues?.name}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="code" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Code
          </label>
          <input
            id="code"
            name="code"
            required
            defaultValue={defaultValues?.code}
            placeholder="e.g. MOF, CUSTOMS"
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={defaultValues?.description ?? ""}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="defaultPosition" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Default chain position
          </label>
          <input
            id="defaultPosition"
            name="defaultPosition"
            type="number"
            min="1"
            step="1"
            defaultValue={defaultValues?.defaultPosition ?? ""}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          />
          <p className="text-xs text-zinc-500">
            Just a suggested starting point -- actual order is set per shipment type on the
            Chains screen.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Active</label>
          <label className="mt-2 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              name="active"
              defaultChecked={defaultValues?.active ?? true}
              className="rounded border-zinc-300 dark:border-zinc-700"
            />
            Ministry can be assigned to new chains
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="requiredDocumentTypes"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Required document types
        </label>
        <input
          id="requiredDocumentTypes"
          name="requiredDocumentTypes"
          defaultValue={defaultValues?.requiredDocumentTypes.join(", ")}
          placeholder="e.g. Commercial Invoice, Packing List, Certificate of Origin"
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />
        <p className="text-xs text-zinc-500">Comma-separated.</p>
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
