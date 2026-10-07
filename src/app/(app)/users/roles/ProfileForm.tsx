import ActionForm, { fieldClass } from "@/components/ActionForm";
import { PERMISSION_GROUPS } from "@/lib/permission-catalog";
import { SERVICE_CATEGORIES, SERVICE_CATEGORY_LABELS } from "@/lib/service-templates";

type State = { error: string | null };

export default function ProfileForm({
  action,
  profile,
  submitLabel,
}: {
  action: (state: State, formData: FormData) => Promise<State>;
  profile?: { name: string; description: string | null; permissions: string[]; jobCategories: string[]; assignedJobsOnly: boolean; approvalLimit: number | null };
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} submitLabel={submitLabel} keepValues className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
          Role name
          <input name="name" required defaultValue={profile?.name} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
          Description
          <input name="description" defaultValue={profile?.description ?? ""} className={fieldClass} />
        </label>
      </div>
      {PERMISSION_GROUPS.map((g) => (
        <fieldset key={g.group} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <legend className="px-1 text-sm font-semibold">{g.group}</legend>
          <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {Object.entries(g.permissions).map(([key, label]) => (
              <label key={key} className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="permissions" value={key} defaultChecked={profile?.permissions.includes(key)} className="mt-0.5" />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <fieldset className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <legend className="px-1 text-sm font-semibold">Which jobs</legend>
        <p className="mb-2 text-xs text-zinc-500">Tick the service lines this role works on. Leave all unticked for every service line.</p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {SERVICE_CATEGORIES.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="jobCategories" value={c} defaultChecked={profile?.jobCategories.includes(c)} />
              {SERVICE_CATEGORY_LABELS[c]}
            </label>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" name="assignedJobsOnly" defaultChecked={profile?.assignedJobsOnly} />
          Only jobs they are responsible for or have tasks on
        </label>
      </fieldset>
      <label className="flex max-w-xs flex-col gap-1 text-xs font-medium text-zinc-500">
        Expense approval limit (empty = no limit)
        <input name="approvalLimit" type="number" min="0" step="0.01" defaultValue={profile?.approvalLimit ?? ""} className={fieldClass} />
      </label>
    </ActionForm>
  );
}
