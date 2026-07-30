"use client";

import { signOutAction } from "@/app/(app)/actions";

export default function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        Sign out
      </button>
    </form>
  );
}
