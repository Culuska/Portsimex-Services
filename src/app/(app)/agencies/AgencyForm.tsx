"use client";

import { useActionState } from "react";

type State = { error: string | null };
const input =
  "rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500";
const lbl = "flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300";

export type AgencyDefaults = {
  name: string;
  department: string;
  office: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  location: string;
  services: string;
  referenceRequirements: string;
  notes: string;
  followUpDays: number;
  active: boolean;
};

export default function AgencyForm({ action, defaults, readOnly }: { action: (s: State, f: FormData) => Promise<State>; defaults: AgencyDefaults; readOnly?: boolean }) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  return (
    <form action={formAction} className="flex max-w-3xl flex-col gap-4">
      <fieldset disabled={readOnly} className="contents">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={`${lbl} sm:col-span-2`}>Ministry / agency<input name="name" required defaultValue={defaults.name} className={input} /></label>
          <label className={lbl}>Department<input name="department" defaultValue={defaults.department} className={input} /></label>
          <label className={lbl}>Office<input name="office" defaultValue={defaults.office} className={input} /></label>
          <label className={lbl}>Contact person<input name="contactName" defaultValue={defaults.contactName} className={input} /></label>
          <label className={lbl}>Location<input name="location" defaultValue={defaults.location} className={input} /></label>
          <label className={lbl}>Phone<input name="contactPhone" defaultValue={defaults.contactPhone} className={input} /></label>
          <label className={lbl}>Email<input name="contactEmail" type="email" defaultValue={defaults.contactEmail} className={input} /></label>
          <label className={`${lbl} sm:col-span-2`}>Services handled<input name="services" defaultValue={defaults.services} placeholder="e.g. Tax exemption certificates, import permits" className={input} /></label>
          <label className={`${lbl} sm:col-span-2`}>Reference / document requirements<textarea name="referenceRequirements" rows={3} defaultValue={defaults.referenceRequirements} className={input} /></label>
          <label className={`${lbl} sm:col-span-2`}>Notes<textarea name="notes" rows={2} defaultValue={defaults.notes} className={input} /></label>
          <label className={lbl}>
            Follow up every (days)
            <input name="followUpDays" type="number" min="1" max="90" defaultValue={defaults.followUpDays} className={input} />
            <span className="text-xs font-normal text-zinc-500">Default gap before the next follow-up after a submission or follow-up.</span>
          </label>
          <label className="flex items-center gap-2 self-end text-sm text-zinc-700 dark:text-zinc-300"><input type="checkbox" name="active" defaultChecked={defaults.active} /> Active</label>
        </div>
      </fieldset>
      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {!readOnly && (
        <div>
          <button type="submit" disabled={pending} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
            {pending ? "Saving..." : "Save agency"}
          </button>
        </div>
      )}
    </form>
  );
}
