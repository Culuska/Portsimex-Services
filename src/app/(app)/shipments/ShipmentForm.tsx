"use client";

import { useActionState, useState } from "react";

type ActionState = { error: string | null };
type ShipmentFormAction = (
  state: ActionState,
  formData: FormData,
) => Promise<ActionState>;

const TYPES = ["IMPORT", "EXPORT", "TRANSSHIPMENT", "DOMESTIC", "CUSTOMS_CLEARANCE"] as const;
const TYPE_LABELS: Record<string, string> = {
  IMPORT: "Import",
  EXPORT: "Export",
  TRANSSHIPMENT: "Transshipment",
  DOMESTIC: "Domestic",
  CUSTOMS_CLEARANCE: "Customs clearance",
};
const TRANSPORT_MODES = [
  { value: "SEA", label: "Sea" },
  { value: "AIR", label: "Air" },
  { value: "ROAD", label: "Road (domestic)" },
] as const;
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
  fromQuote,
}: {
  action: ShipmentFormAction;
  clients: { id: string; name: string }[];
  users: { id: string; name: string }[];
  // Present only when creating a shipment from an accepted quote: locks
  // the client and job type to the quote's, and carries the quote's
  // number through as a hidden field -- that number becomes the
  // shipment's tracking reference server-side (see createShipmentAction).
  fromQuote?: {
    id: string;
    quoteNumber: string;
    clientId: string;
    clientName: string;
    type: string;
  };
  defaultValues?: {
    clientId: string;
    assigneeId: string | null;
    type: string;
    transportMode: string;
    status: string;
    origin: string;
    destination: string;
    cargoDescription: string | null;
    containerNumber: string | null;
    vessel: string | null;
    billOfLading: string | null;
    airwayBill: string | null;
    flightCarrier: string | null;
    vehicleType: string | null;
    etd: Date | null;
    eta: Date | null;
  };
  submitLabel: string;
  showStatus?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [transportMode, setTransportMode] = useState(defaultValues?.transportMode ?? "SEA");

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-2xl">
      {fromQuote && (
        <div className="rounded-md border border-brand-200 dark:border-brand-900 bg-brand-50 dark:bg-brand-950 p-3 text-sm">
          <p className="font-medium text-zinc-900 dark:text-zinc-50">
            Starting from accepted quote {fromQuote.quoteNumber}
          </p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-300">
            This shipment will use <span className="font-mono">{fromQuote.quoteNumber}</span> as
            its tracking reference -- the same number follows the job from quotation through to
            delivery.
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="clientId" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Client
          </label>
          {fromQuote ? (
            <>
              <input
                type="text"
                readOnly
                value={fromQuote.clientName}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-500 outline-none"
              />
              <input type="hidden" name="clientId" value={fromQuote.clientId} />
              <input type="hidden" name="quoteId" value={fromQuote.id} />
            </>
          ) : (
            <select
              id="clientId"
              name="clientId"
              required
              defaultValue={defaultValues?.clientId}
              className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select a client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="assigneeId" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Assignee
          </label>
          <select
            id="assigneeId"
            name="assigneeId"
            defaultValue={defaultValues?.assigneeId ?? ""}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
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

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="type" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Type
          </label>
          {fromQuote ? (
            <>
              <input
                type="text"
                readOnly
                value={TYPE_LABELS[fromQuote.type] ?? fromQuote.type}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-500 outline-none"
              />
              <input type="hidden" name="type" value={fromQuote.type} />
            </>
          ) : (
            <select
              id="type"
              name="type"
              defaultValue={defaultValues?.type ?? "IMPORT"}
              className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="transportMode" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Transport mode
          </label>
          <select
            id="transportMode"
            name="transportMode"
            value={transportMode}
            onChange={(e) => setTransportMode(e.target.value)}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          >
            {TRANSPORT_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
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
            className="w-fit rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      )}

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
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
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
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
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
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
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
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      {transportMode === "SEA" && (
        <div className="rounded-md border border-zinc-200 dark:border-zinc-800 p-4">
          <p className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Sea freight details
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="vessel" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Vessel
              </label>
              <input
                id="vessel"
                name="vessel"
                defaultValue={defaultValues?.vessel ?? ""}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="containerNumber"
                className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Container #
              </label>
              <input
                id="containerNumber"
                name="containerNumber"
                defaultValue={defaultValues?.containerNumber ?? ""}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <label
                htmlFor="billOfLading"
                className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Bill of lading #
              </label>
              <input
                id="billOfLading"
                name="billOfLading"
                defaultValue={defaultValues?.billOfLading ?? ""}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>
      )}

      {transportMode === "AIR" && (
        <div className="rounded-md border border-zinc-200 dark:border-zinc-800 p-4">
          <p className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Air freight details
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="airwayBill"
                className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Airway bill #
              </label>
              <input
                id="airwayBill"
                name="airwayBill"
                defaultValue={defaultValues?.airwayBill ?? ""}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="flightCarrier"
                className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Flight / carrier
              </label>
              <input
                id="flightCarrier"
                name="flightCarrier"
                placeholder="e.g. Ethiopian Airlines ET-702"
                defaultValue={defaultValues?.flightCarrier ?? ""}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>
      )}

      {transportMode === "ROAD" && (
        <div className="rounded-md border border-zinc-200 dark:border-zinc-800 p-4">
          <p className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Road transport details
          </p>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="vehicleType"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Vehicle / transport type
            </label>
            <input
              id="vehicleType"
              name="vehicleType"
              placeholder="e.g. 10-ton truck, flatbed trailer"
              defaultValue={defaultValues?.vehicleType ?? ""}
              className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="cargoDescription" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Cargo description
        </label>
        <textarea
          id="cargoDescription"
          name="cargoDescription"
          rows={3}
          defaultValue={defaultValues?.cargoDescription ?? ""}
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
