"use client";

import { useState } from "react";
import Link from "next/link";
import Nav from "./Nav";
import SignOutButton from "./SignOutButton";
import type { Role } from "@/lib/roles";

export default function MobileMenu({
  role,
  userName,
  userRole,
  unreadCount,
}: {
  role: Role;
  userName?: string | null;
  userRole: string;
  unreadCount: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-brand-800 dark:text-brand-200">
            Portsimex <span className="text-accent-600">Services</span>
          </p>
          <p className="text-[10px] font-medium text-zinc-400">Your World brought closer</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-md border border-zinc-300 dark:border-zinc-700 p-2 text-zinc-700 dark:text-zinc-300"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
            <path
              d="M3 5h14M3 10h14M3 15h14"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="relative flex h-full w-72 max-w-[85vw] flex-col justify-between bg-white dark:bg-zinc-950 p-4 shadow-xl">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-brand-800 dark:text-brand-200">
                    Portsimex <span className="text-accent-600">Services</span>
                  </p>
                  <p className="text-[10px] font-medium text-zinc-400">
                    Your World brought closer
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                    <path
                      d="M5 5l10 10M15 5L5 15"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
              <Nav role={role} onNavigate={() => setOpen(false)} />
            </div>
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="mb-3 flex items-center justify-between rounded-md px-1 py-1 text-sm text-zinc-600 dark:text-zinc-300"
              >
                Notifications
                {unreadCount > 0 && (
                  <span className="rounded-full bg-accent-600 px-2 py-0.5 text-xs font-medium text-white">
                    {unreadCount}
                  </span>
                )}
              </Link>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{userName}</p>
              <p className="text-xs text-zinc-500">{userRole}</p>
              <div className="mt-2">
                <SignOutButton />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
