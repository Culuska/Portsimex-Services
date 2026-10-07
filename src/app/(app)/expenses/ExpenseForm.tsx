"use client";

import { useActionState, useState } from "react";

// Suggested categories (free text is still allowed).
const SUGGESTED_CATEGORIES = [
  "Transport",
  "Fuel",
  "Customs",
  "Port",
  "Government fees",
  "Ministry processing",
  "Immigration fees",
  "Vehicle rental cost",
  "Vehicle maintenance",
  "Driver allowance",
  "Accommodation",
  "Communication",
  "SIM / telecom cost",
  "Supplier charges",
  "Courier",
  "Office expenses",
  "Bank charges",
  "Other",
];

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
  jobs = [],
  defaultValues,
  submitLabel,
  lockAmount = false,
  lockStatus = false,
  lockBilling = false,
  moneyAccounts = [],
  allowReceipt = false,
  approvalThreshold = 500,
}: {
  action: ExpenseFormAction;
  vendors: { id: string; name: string }[];
  shipments: { id: string; reference: string }[];
  categories: { id: string; name: string }[];
  // Open jobs to attribute the cost to.
  jobs?: { id: string; label: string }[];
  defaultValues?: {
    description: string;
    amount: string;
    categoryName: string;
    vendorId: string | null;
    shipmentId: string | null;
    status: string;
    incurredAt: Date | string;
    jobId?: string | null;
    billingType?: string | null;
    markupAmount?: string;
  };
  submitLabel: string;
  // True once the expense has already been accrued to the ledger --
  // amount/category become read-only so an edit can never desync the
  // posted balance. Use the approve/reject/pay actions to change status
  // from here on instead of the dropdown below.
  lockAmount?: boolean;
  lockStatus?: boolean;
  // True once the cost is on an invoice -- job and markup can no longer change.
  lockBilling?: boolean;
  // Cash / bank accounts the expense can be paid from.
  moneyAccounts?: { id: string; name: string }[];
  allowReceipt?: boolean;
  approvalThreshold?: number;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [billingType, setBillingType] = useState(defaultValues?.billingType ?? "");
  const [status, setStatus] = useState(defaultValues?.status ?? "PENDING");

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
            readOnly={lockAmount}
            defaultValue={defaultValues?.amount}
            className={`rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 ${
              lockAmount
                ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500"
                : "bg-white dark:bg-zinc-900"
            }`}
          />
          {lockAmount && (
            <p className="text-xs text-zinc-500">
              Locked once posted to the ledger -- create a new expense to correct a mistake.
            </p>
          )}
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
          readOnly={lockAmount}
          defaultValue={defaultValues?.categoryName}
          className={`rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 ${
            lockAmount
              ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500"
              : "bg-white dark:bg-zinc-900"
          }`}
        />
        <datalist id="category-options">
          {Array.from(new Set([...SUGGESTED_CATEGORIES, ...categories.map((c) => c.name)])).map((name) => (
            <option key={name} value={name} />
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

      <fieldset className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <legend className="px-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">Job &amp; billing</legend>
        <div className="flex flex-col gap-1">
          <label htmlFor="jobId" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Job / case</label>
          <select id="jobId" name="jobId" defaultValue={defaultValues?.jobId ?? ""} disabled={lockBilling} className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500">
            <option value="">Not linked to a job (company overhead)</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.label}</option>
            ))}
          </select>
          {lockBilling && <input type="hidden" name="jobId" value={defaultValues?.jobId ?? ""} />}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="billingType" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Who pays for this cost?</label>
            <select
              id="billingType"
              name="billingType"
              required
              value={billingType}
              onChange={(e) => setBillingType(e.target.value)}
              disabled={lockAmount}
              className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="" disabled>Choose…</option>
              <option value="NON_BILLABLE">Company cost (not re-charged)</option>
              <option value="BILLABLE">Re-charge to client at cost</option>
              <option value="BILLABLE_WITH_MARKUP">Re-charge at cost + handling fee</option>
            </select>
            {lockAmount && <input type="hidden" name="billingType" value={billingType} />}
          </div>
          {billingType === "BILLABLE_WITH_MARKUP" && (
            <div className="flex flex-col gap-1">
              <label htmlFor="markupAmount" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Handling / service fee</label>
              <input id="markupAmount" name="markupAmount" type="number" min="0" step="0.01" required readOnly={lockBilling} defaultValue={defaultValues?.markupAmount ?? ""} className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          )}
        </div>
        <p className="text-xs text-zinc-500">
          {lockAmount
            ? "Billing type is locked once the cost is posted to the ledger."
            : "Re-charged costs are held as an amount the client owes back (not company expense) until invoiced -- e.g. a government fee paid for the client. Company costs reduce the job's profit."}
        </p>
      </fieldset>

      {lockStatus ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Status</p>
          <p className="text-xs text-zinc-500">
            In the approval workflow now -- use the actions below to change it.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Status
          </label>
          <select
            id="status"
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-fit rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
          </select>
          <p className="text-xs text-zinc-500">
            Amounts over ${approvalThreshold.toLocaleString("en-US")} are automatically routed to approval instead of Paid.
          </p>
        </div>
      )}

      {!lockStatus && status === "PAID" && moneyAccounts.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="paidFromId" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Paid from
            </label>
            <select id="paidFromId" name="paidFromId" className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500">
              {moneyAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="paymentMethod" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Payment method
            </label>
            <select id="paymentMethod" name="paymentMethod" defaultValue="CASH" className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500">
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="MOBILE_MONEY">Mobile money</option>
              <option value="CARD">Card</option>
              <option value="CHECK">Cheque</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>
      )}

      {allowReceipt && (
        <div className="flex flex-col gap-1">
          <label htmlFor="receipt" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Receipt (optional)
          </label>
          <input id="receipt" name="receipt" type="file" accept="image/*,application/pdf" className="text-sm text-zinc-600 dark:text-zinc-300" />
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
