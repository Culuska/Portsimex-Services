"use client";

import { useActionState } from "react";
import { createUserAction } from "../actions";

export default function UserForm() {
  const [state, formAction, pending] = useActionState(createUserAction, {
    error: null,
  });

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-md">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Name
        </label>
        <input
          id="name"
          name="name"
          required
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
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
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Temporary password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="role" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Role
        </label>
        <select
          id="role"
          name="role"
          defaultValue="STAFF"
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="STAFF">Staff</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>
      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 w-fit rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "Creating..." : "Create user"}
      </button>
    </form>
  );
}
