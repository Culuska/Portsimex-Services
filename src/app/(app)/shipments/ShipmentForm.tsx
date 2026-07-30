"use client";

import { useActionState } from "react";

type ActionState = { error: string | null };
type ShipmentFormAction = (
  state: ActionState,
  formData: FormData,
) => Promise<ActionState>;

const TYPES = ["IMPORT", "EXPORT", "TRANSSHIPMENT", "DOMESTIC"] as const;
const STATUSES = [
  "PENDING",
  "IN_TRANSIT",
  "ARRIVED",
  "CUSTOMS_HOLD",
  "COMPLETED",
  "CANCELLED",
] as const;

function toDateInputValue(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

export default function ShipmentForm({
  action,
  clients,
  users,
  defaultValues,
  submitLabel,
  showStatus = false,
}: {
  action: ShipmentFormAction;
  clients: { id: string; name: string }[];
  users: { id: string; name: string }[];
  defaultValues?: {
    clientId: string;
    assigneeId: string | null;
    type: string;
    status: string;
    origin: string;
    destination: string;
    cargoDescription: string | null;
    containerNumber: string | null;
    vessel: string | null;
    etd: Date | null;
    eta: Date | null;
  };
  submitLabel: string;
  showStatus?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });

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
            defaultValue={defaultValues?.clientId}
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
          <label htmlFor="assigneeId" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Assignee
          </label>
          <select
            id="assigneeId"
            name="assigneeId"
            defaultValue={defaultValues?.assigneeId ?? ""}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={`grid gap-4 ${showStatus ? "grid-cols-2" : "grid-cols-1"}`}>
        <div className="flex flex-col gap-1">
          <label htmlFor="type" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Type
          </label>
          <select
            id="type"
            name="type"
            defaultValue={defaultValues?.type ?? "IMPORT"}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        {showStatus && (
          <div className="flex flex-col gap-1">
            <label htmlFor="status" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={defaultValues?.status ?? "PENDING"}
              className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="origin" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Origin
          </label>
          <input
            id="origin"
            name="origin"
            required
            defaultValue={defaultValues?.origin}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="destination" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Destination
          </label>
          <input
            id="destination"
            name="destination"
            required
            defaultValue={defaultValues?.destination}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="etd" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            ETD
          </label>
          <input
            id="etd"
            name="etd"
            type="date"
            defaultValue={toDateInputValue(defaultValues?.etd)}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="eta" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            ETA
          </label>
          <input
            id="eta"
            name="eta"
            type="date"
            defaultValue={toDateInputValue(defaultValues?.eta)}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="containerNumber" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Container #
          </label>
          <input
            id="containerNumber"
            name="containerNumber"
            defaultValue={defaultValues?.containerNumber ?? ""}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="vessel" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Vessel
          </label>
          <input
            id="vessel"
            name="vessel"
            defaultValue={defaultValues?.vessel ?? ""}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="cargoDescription" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Cargo description
        </label>
        <textarea
          id="cargoDescription"
          name="cargoDescription"
          rows={3}
          defaultValue={defaultValues?.cargoDescription ?? ""}
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
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
