"use client";

import { useActionState } from "react";
import { SERVICE_CATEGORIES, SERVICE_CATEGORY_LABELS } from "@/lib/service-templates";

type State = { error: string | null };

const input =
  "rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500";
const lbl = "text-sm font-medium text-zinc-700 dark:text-zinc-300";

export default function ServiceForm({
  action,
  defaults,
}: {
  action: (s: State, f: FormData) => Promise<State>;
  defaults: {
    name: string;
    code: string;
    category: string;
    jobPrefix: string;
    description: string;
    slaDays: string;
    active: boolean;
    reconcileQuantities: boolean;
    stages: string;
    documents: string;
    tasks: string;
    fields: string;
  };
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  return (
    <form action={formAction} className="flex max-w-3xl flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className={lbl}>Service name</label>
          <input id="name" name="name" required defaultValue={defaults.name} className={input} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="category" className={lbl}>Category</label>
          <select id="category" name="category" defaultValue={defaults.category} className={input}>
            {SERVICE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{SERVICE_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="code" className={lbl}>Code</label>
          <input id="code" name="code" required defaultValue={defaults.code} placeholder="e.g. SIM_REGISTRATION" className={input} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="jobPrefix" className={lbl}>Job prefix</label>
            <input id="jobPrefix" name="jobPrefix" required defaultValue={defaults.jobPrefix} placeholder="TAX" className={input} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="slaDays" className={lbl}>SLA (days)</label>
            <input id="slaDays" name="slaDays" type="number" min="0" defaultValue={defaults.slaDays} placeholder="0 = same day" className={input} />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="description" className={lbl}>Description</label>
        <input id="description" name="description" defaultValue={defaults.description} className={input} />
      </div>

      <TemplateBox
        name="stages"
        label="Workflow stages"
        help={'One per line, in order. Add "| docs" to block a stage until all required documents are received.'}
        value={defaults.stages}
      />
      <TemplateBox
        name="documents"
        label="Document checklist"
        help={'One per line. Add "| optional" for non-required documents, or "| output" for the official output the job cannot be completed without (certificate, POD, final visa…).'}
        value={defaults.documents}
      />
      <TemplateBox
        name="tasks"
        label="Tasks created with each job"
        help={'One per line. Add "| N" to make the task due N days after the job starts.'}
        value={defaults.tasks}
      />
      <TemplateBox
        name="fields"
        label="Service-specific fields"
        help={'One per line: "key | Label | type" where type is text, number, date, textarea or select. For select add "| Option A, Option B".'}
        value={defaults.fields}
      />

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" name="active" defaultChecked={defaults.active} /> Active (offered on new service requests)
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" name="reconcileQuantities" defaultChecked={defaults.reconcileQuantities} /> Bulk service: reconcile
          quantities (uses fields quantityRequested / quantityProcessed / quantityFailed)
        </label>
      </div>

      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      <div>
        <button type="submit" disabled={pending} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          {pending ? "Saving..." : "Save service"}
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        Changes apply to jobs opened from now on. Jobs already in progress keep the workflow they were opened with.
      </p>
    </form>
  );
}

function TemplateBox({ name, label, help, value }: { name: string; label: string; help: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className={lbl}>{label}</label>
      <textarea id={name} name={name} rows={Math.min(14, Math.max(4, value.split("\n").length + 1))} defaultValue={value} className={`${input} font-mono`} />
      <p className="text-xs text-zinc-500">{help}</p>
    </div>
  );
}
