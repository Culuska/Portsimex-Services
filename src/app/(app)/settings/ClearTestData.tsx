"use client";

import { useActionState } from "react";
import { fieldClass } from "@/components/ActionForm";
import { clearTestDataAction } from "./actions";

export default function ClearTestData() {
  const [state, formAction, pending] = useActionState(clearTestDataAction, { error: null });
  if (state.done) {
    return (
      <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
        Test data cleared. Numbering starts again from 1 (SR-…-00001, INV-…-0001). Re-enter your opening bank and cash balances under Finance → Journal
        entries, then add your clients.
      </p>
    );
  }
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm("Permanently delete all test data? This cannot be undone.")) e.preventDefault();
      }}
      className="flex flex-col gap-3"
    >
      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="font-medium text-red-700 dark:text-red-400">Deleted</p>
          <p className="text-zinc-600 dark:text-zinc-300">
            Service requests, jobs and cases, quotes, invoices and payments, expenses, supplier bills, client advances, purchase requests, shipments and
            clearances, accounting entries, notifications, the audit history -- and clients, vendors and government agencies.
          </p>
        </div>
        <div>
          <p className="font-medium text-emerald-700 dark:text-emerald-400">Kept</p>
          <p className="text-zinc-600 dark:text-zinc-300">
            Users and their roles, settings, the service catalog, ministries, chart of accounts, expense categories and bank / cash accounts (balances start
            again from zero). Vendor-portal logins are switched off.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
          Your password
          <input name="password" type="password" required autoComplete="current-password" className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
          Type CLEAR to confirm
          <input name="confirm" required autoComplete="off" placeholder="CLEAR" className={`${fieldClass} w-32`} />
        </label>
        <button type="submit" disabled={pending} className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">
          {pending ? "Clearing..." : "Clear all test data"}
        </button>
      </div>
      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
    </form>
  );
}
