"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/roles";

const opsLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/shipments", label: "Shipments" },
  { href: "/quotes", label: "Quotes" },
  { href: "/invoices", label: "Invoices" },
  { href: "/purchase-requests", label: "Purchase Requests" },
  { href: "/expenses", label: "Expenses" },
  { href: "/clients", label: "Clients" },
  { href: "/vendors", label: "Vendors" },
];

const adminExtraLinks = [
  { href: "/accounting", label: "Accounting" },
  { href: "/users", label: "Users" },
  { href: "/ministries", label: "Ministries" },
  { href: "/ministry", label: "Ministry Queue" },
  { href: "/deliveries", label: "Deliveries" },
];

// Roles scoped to the ministry-clearance module get a focused menu instead
// of the full internal ops app (which shows every client's data).
const roleLinks: Partial<Record<Role, { href: string; label: string }[]>> = {
  MINISTRY_REGISTRAR: [{ href: "/ministries", label: "Ministries" }],
  MINISTRY_OFFICER: [{ href: "/ministry", label: "Ministry Queue" }],
  VENDOR: [{ href: "/my-shipments", label: "My Shipments" }],
  LOGISTICS_STAFF: [{ href: "/deliveries", label: "Deliveries" }],
};

export default function Nav({
  role,
  onNavigate,
}: {
  role: Role;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const items =
    role === "ADMIN"
      ? [...opsLinks, ...adminExtraLinks]
      : role === "STAFF"
        ? opsLinks
        : (roleLinks[role] ?? []);

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-brand-600 text-white"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
