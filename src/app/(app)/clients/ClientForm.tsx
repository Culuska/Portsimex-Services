"use client";

import { useActionState, useState } from "react";
import {
  SERVICE_TYPE_LABELS,
  RATE_BASED_SERVICE_TYPES,
  FLAT_SERVICE_TYPES,
  AGREEMENT_TYPES,
  AGREEMENT_TYPE_LABELS,
} from "@/lib/services";

type ActionState = { error: string | null };
type ClientFormAction = (
  state: ActionState,
  formData: FormData,
) => Promise<ActionState>;

export default function ClientForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: ClientFormAction;
  defaultValues?: {
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    notes: string | null;
    stage?: string;
    agreementType?: string | null;
    services?: string[];
    serviceRates?: Record<string, string>;
  };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [checkedServices, setCheckedServices] = useState<Set<string>>(
    new Set(defaultValues?.services ?? []),
  );

  function toggleService(service: string, checked: boolean) {
    setCheckedServices((prev) => {
      const next = new Set(prev);
      if (checked) next.add(service);
      else next.delete(service);
      return next;
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-lg">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Company name
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={defaultValues?.name}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      {defaultValues && (
        <div className="flex flex-col gap-1">
          <label htmlFor="stage" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Relationship stage
          </label>
          <select
            id="stage"
            name="stage"
            defaultValue={defaultValues?.stage ?? "ACTIVE"}
            className="w-fit rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="PROSPECT">Prospect</option>
            <option value="ACTIVE">Active</option>
            <option value="DORMANT">Dormant</option>
            <option value="LOST">Lost</option>
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="agreementType" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Agreement type
        </label>
        <select
          id="agreementType"
          name="agreementType"
          defaultValue={defaultValues?.agreementType ?? ""}
          className="w-fit rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Not set</option>
          {AGREEMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {AGREEMENT_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Rate-based services
          </p>
          <p className="mb-2 text-xs text-zinc-500">
            Billed at market cost + the agreed rate below, tied to a Purchase Request.
          </p>
          <div className="flex flex-col gap-2">
            {RATE_BASED_SERVICE_TYPES.map((service) => (
              <div key={service} className="flex items-center gap-3">
                <label className="flex w-48 items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    name="services"
                    value={service}
                    checked={checkedServices.has(service)}
                    onChange={(e) => toggleService(service, e.target.checked)}
                    className="rounded border-zinc-300 dark:border-zinc-700"
                  />
                  {SERVICE_TYPE_LABELS[service]}
                </label>
                {checkedServices.has(service) && (
                  <div className="flex items-center gap-1">
                    <input
                      name={`rate_${service}`}
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      placeholder="Rate %"
                      defaultValue={defaultValues?.serviceRates?.[service] ?? ""}
                      className="w-24 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <span className="text-sm text-zinc-500">%</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Flat services</p>
          <p className="mb-2 text-xs text-zinc-500">
            Quoted with a direct price each time, no agreed rate needed.
          </p>
          <div className="flex flex-col gap-1.5">
            {FLAT_SERVICE_TYPES.map((service) => (
              <label key={service} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  name="services"
                  value={service}
                  defaultChecked={defaultValues?.services?.includes(service)}
                  className="rounded border-zinc-300 dark:border-zinc-700"
                />
                {SERVICE_TYPE_LABELS[service]}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={defaultValues?.email ?? ""}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="phone" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            defaultValue={defaultValues?.phone ?? ""}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="address" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Address
        </label>
        <input
          id="address"
          name="address"
          defaultValue={defaultValues?.address ?? ""}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={defaultValues?.notes ?? ""}
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
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
