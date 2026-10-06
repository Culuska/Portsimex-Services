"use client";

import { useActionState, useState } from "react";
import { createServiceRequestAction } from "./actions";

type ServiceOption = { id: string; name: string; categoryLabel: string; slaDays: number | null };

const input =
  "rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500";
const lbl = "text-sm font-medium text-zinc-700 dark:text-zinc-300";

export default function ServiceRequestForm({
  clients,
  services,
  users,
  canApprove,
  defaults,
}: {
  clients: { id: string; name: string }[];
  services: ServiceOption[];
  users: { id: string; name: string }[];
  canApprove: boolean;
  defaults: { clientId?: string; quoteId?: string; quoteNumber?: string; description?: string; estimatedRevenue?: string; estimatedCost?: string };
}) {
  const [state, formAction, pending] = useActionState(createServiceRequestAction, { error: null });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const groups = Array.from(new Set(services.map((s) => s.categoryLabel)));

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={formAction} className="flex max-w-4xl flex-col gap-5">
      <input type="hidden" name="quoteId" value={defaults.quoteId ?? ""} />
      {defaults.quoteNumber && (
        <p className="rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-800 dark:bg-brand-900/30 dark:text-brand-200">
          Converting accepted quotation {defaults.quoteNumber} into a service request.
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor="clientId" className={lbl}>Client</label>
          <select id="clientId" name="clientId" required defaultValue={defaults.clientId ?? ""} className={input}>
            <option value="">Select a client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="priority" className={lbl}>Priority</label>
          <select id="priority" name="priority" defaultValue="NORMAL" className={input}>
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="requestedByName" className={lbl}>Requesting person</label>
          <input id="requestedByName" name="requestedByName" className={input} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="department" className={lbl}>Client department</label>
          <input id="department" name="department" className={input} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="requiredBy" className={lbl}>Required completion date</label>
          <input id="requiredBy" name="requiredBy" type="date" className={input} />
        </div>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className={lbl}>Services requested <span className="font-normal text-zinc-500">({picked.size} selected -- each becomes its own job)</span></legend>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <div key={g} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{g}</p>
              <div className="flex flex-col gap-1.5">
                {services
                  .filter((s) => s.categoryLabel === g)
                  .map((s) => (
                    <label key={s.id} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                      <input type="checkbox" name="serviceIds" value={s.id} checked={picked.has(s.id)} onChange={() => toggle(s.id)} className="mt-0.5" />
                      <span>
                        {s.name}
                        {s.slaDays !== null && (
                          <span className="ml-1 text-xs text-zinc-400">· {s.slaDays === 0 ? "same day" : `${s.slaDays}d`}</span>
                        )}
                      </span>
                    </label>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className={lbl}>What the client needs</label>
        <textarea id="description" name="description" required rows={4} defaultValue={defaults.description} className={input} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="location" className={lbl}>Location</label>
          <input id="location" name="location" className={input} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="assignedDepartment" className={lbl}>Assigned department</label>
          <input id="assignedDepartment" name="assignedDepartment" placeholder="e.g. Operations" className={input} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="assignedToId" className={lbl}>Assigned employee</label>
          <select id="assignedToId" name="assignedToId" defaultValue="" className={input}>
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="estimatedRevenue" className={lbl}>Estimated revenue</label>
          <input id="estimatedRevenue" name="estimatedRevenue" type="number" min="0" step="0.01" defaultValue={defaults.estimatedRevenue} className={input} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="estimatedCost" className={lbl}>Estimated cost</label>
          <input id="estimatedCost" name="estimatedCost" type="number" min="0" step="0.01" defaultValue={defaults.estimatedCost} className={input} />
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" name="submit" value="SUBMITTED" disabled={pending} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          {pending ? "Saving..." : "Submit request"}
        </button>
        {canApprove && (
          <button type="submit" name="submit" value="APPROVE" disabled={pending} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
            Approve &amp; open jobs now
          </button>
        )}
        <button type="submit" name="submit" value="DRAFT" disabled={pending} className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-60">
          Save as draft
        </button>
      </div>
    </form>
  );
}
