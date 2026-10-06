"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/roles";
import { isFullAccessRole } from "@/lib/roles";

const opsLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/service-requests", label: "Service Requests" },
  { href: "/jobs", label: "Jobs / Cases" },
  { href: "/cases", label: "Tax & Immigration Cases" },
  { href: "/reminders", label: "Follow-ups & Alerts" },
  { href: "/clients", label: "Clients" },
  { href: "/quotes", label: "Quotes" },
  { href: "/invoices", label: "Invoices" },
  { href: "/expenses", label: "Expenses" },
  { href: "/finance/bills", label: "Supplier Bills" },
  { href: "/finance/advances", label: "Client Advances" },
  { href: "/finance", label: "Finance" },
  { href: "/purchase-requests", label: "Purchase Requests" },
  { href: "/shipments", label: "Shipments" },
  { href: "/vendors", label: "Vendors" },
  { href: "/agencies", label: "Government Agencies" },
];

const adminExtraLinks = [
  { href: "/finance/reports/profit-loss", label: "Financial Reports" },
  { href: "/reports", label: "Profitability" },
  { href: "/accounting", label: "Accounting" },
  { href: "/services", label: "Service Catalog" },
  { href: "/users", label: "Users" },
  { href: "/ministries", label: "Tax Exemption Registry" },
  { href: "/ministry", label: "Tax Exemption Queue" },
  { href: "/deliveries", label: "Deliveries" },
  { href: "/audit", label: "Audit Trail" },
];

// Roles scoped to the ministry-clearance module get a focused menu instead
// of the full internal ops app (which shows every client's data).
const roleLinks: Partial<Record<Role, { href: string; label: string }[]>> = {
  MINISTRY_REGISTRAR: [{ href: "/ministries", label: "Tax Exemption Registry" }],
  MINISTRY_OFFICER: [{ href: "/ministry", label: "Tax Exemption Queue" }],
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

  const items = isFullAccessRole(role)
    ? [...opsLinks, ...adminExtraLinks]
    : role === "STAFF"
      ? opsLinks
      : (roleLinks[role] ?? []);

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        // The most specific matching link wins (/finance/bills over /finance).
        const matches = (href: string) =>
          href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
        const active =
          matches(item.href) &&
          !items.some((other) => other.href.length > item.href.length && other.href.startsWith(item.href) && matches(other.href));
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
