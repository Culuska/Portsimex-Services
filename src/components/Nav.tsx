"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/roles";

// Each link shows only to users holding one of its permissions (the pages
// and actions enforce the same permissions server-side).
const links: { href: string; label: string; anyOf?: string[] }[] = [
  { href: "/", label: "Dashboard", anyOf: ["jobs.view", "finance.view", "invoices.view", "expenses.view", "clients.view"] },
  { href: "/service-requests", label: "Service Requests", anyOf: ["requests.manage", "requests.approve"] },
  { href: "/jobs", label: "Jobs / Cases", anyOf: ["jobs.view"] },
  { href: "/cases", label: "Tax & Immigration Cases", anyOf: ["jobs.view"] },
  { href: "/reminders", label: "Follow-ups & Alerts", anyOf: ["jobs.view"] },
  { href: "/clients", label: "Clients", anyOf: ["clients.view"] },
  { href: "/quotes", label: "Quotes", anyOf: ["quotes.manage"] },
  { href: "/invoices", label: "Invoices", anyOf: ["invoices.view"] },
  { href: "/expenses", label: "Expenses", anyOf: ["expenses.view"] },
  { href: "/finance/bills", label: "Supplier Bills", anyOf: ["finance.view", "bills.manage"] },
  { href: "/finance/advances", label: "Client Advances", anyOf: ["finance.view", "payments.record"] },
  { href: "/finance", label: "Finance", anyOf: ["finance.view"] },
  { href: "/purchase-requests", label: "Purchase Requests", anyOf: ["purchases.manage", "purchases.approve"] },
  { href: "/shipments", label: "Shipments", anyOf: ["shipments.manage"] },
  { href: "/vendors", label: "Vendors", anyOf: ["vendors.manage"] },
  { href: "/agencies", label: "Government Agencies", anyOf: ["jobs.view", "agencies.manage"] },
  { href: "/finance/reports/profit-loss", label: "Financial Reports", anyOf: ["reports.financial"] },
  { href: "/reports", label: "Profitability", anyOf: ["reports.operational"] },
  { href: "/accounting", label: "Accounting", anyOf: ["reports.financial"] },
  { href: "/services", label: "Service Catalog", anyOf: ["catalog.manage"] },
  { href: "/users", label: "Users & Roles", anyOf: ["users.manage"] },
  { href: "/settings", label: "Settings", anyOf: ["settings.manage"] },
  { href: "/ministries", label: "Tax Exemption Registry", anyOf: ["__admin__"] },
  { href: "/ministry", label: "Tax Exemption Queue", anyOf: ["__admin__"] },
  { href: "/deliveries", label: "Deliveries", anyOf: ["__admin__"] },
  { href: "/audit", label: "Audit Trail", anyOf: ["audit.view"] },
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
  permissions,
  fullAccess,
  onNavigate,
}: {
  role: Role;
  permissions: string[];
  fullAccess: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const items = roleLinks[role] ?? links.filter((l) => fullAccess || !l.anyOf || l.anyOf.some((p) => permissions.includes(p)));

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
