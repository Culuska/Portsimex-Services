"use client";

import { useActionState, useState } from "react";

type ActionState = { error: string | null };
type UserFormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

const ROLE_LABELS: Record<string, string> = {
  STAFF: "Staff",
  SUPERVISOR: "Supervisor",
  ADMIN: "Admin (SuperAdmin)",
  MINISTRY_REGISTRAR: "Ministry Registrar",
  MINISTRY_OFFICER: "Ministry Officer",
  VENDOR: "Vendor",
  LOGISTICS_STAFF: "Logistics Staff",
};

const ROLE_PERMISSIONS: Record<string, string> = {
  STAFF:
    "Full access to daily operations: shipments, quotes, invoices, expenses, clients, vendors, purchase requests. Cannot manage Users or Accounting.",
  SUPERVISOR:
    "Full access to everything in the app, with no restrictions -- identical to Admin, including Users, Accounting/Ledger, and every approval step (expense approval, starting a shipment from an accepted quote, ministry registry).",
  ADMIN:
    "Full access to everything in the app, with no restrictions -- including Users, Accounting/Ledger, and every approval step (expense approval, starting a shipment from an accepted quote, ministry registry).",
  MINISTRY_REGISTRAR:
    "Limited to the Ministries section only: registering ministries and setting their position in a shipment type's approval chain. No access to shipments, invoices, or other company data.",
  MINISTRY_OFFICER:
    "Limited to their assigned ministry's approval queue only: reviewing and approving/rejecting/requesting correction on clearance documents for that ministry. No access to other company data.",
  VENDOR:
    "Portal access limited to their own company's shipments and clearance documents only -- uploading documents and tracking clearance status. No access to other clients' data or company financials.",
  LOGISTICS_STAFF:
    "Limited to the Deliveries queue: creating a delivery record (airport/seaport) once a shipment is cleared. No access to other company data.",
};

export default function UserForm({
  action,
  ministries,
  clients,
  defaultValues,
  submitLabel,
}: {
  action: UserFormAction;
  ministries: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  defaultValues?: {
    name: string;
    email: string;
    role: string;
    ministryId: string | null;
    vendorClientId: string | null;
  };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {
    error: null,
  });
  const [role, setRole] = useState(defaultValues?.role ?? "STAFF");
  const isEdit = Boolean(defaultValues);

  return (
    <form action={formAction} autoComplete="off" className="flex flex-col gap-4 max-w-md">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Name
        </label>
        <input
          id="name"
          name="name"
          required
          autoComplete="off"
          defaultValue={defaultValues?.name}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="off"
          defaultValue={defaultValues?.email}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {isEdit ? "New password (leave blank to keep current)" : "Temporary password"}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required={!isEdit}
          minLength={8}
          autoComplete="new-password"
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="role" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Role
        </label>
        <select
          id="role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        >
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <p className="rounded-md bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
          {ROLE_PERMISSIONS[role]}
        </p>
      </div>

      {(role === "MINISTRY_OFFICER" || role === "MINISTRY_REGISTRAR") && (
        <div className="flex flex-col gap-1">
          <label htmlFor="ministryId" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Ministry
          </label>
          <select
            id="ministryId"
            name="ministryId"
            required
            defaultValue={defaultValues?.ministryId ?? ""}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Select a ministry</option>
            {ministries.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {role === "VENDOR" && (
        <div className="flex flex-col gap-1">
          <label htmlFor="vendorClientId" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Vendor company (Client)
          </label>
          <select
            id="vendorClientId"
            name="vendorClientId"
            required
            defaultValue={defaultValues?.vendorClientId ?? ""}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Select a client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-zinc-500">
            This user will only be able to see shipments/documents for this client.
          </p>
        </div>
      )}

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
