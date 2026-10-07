"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import type { Role } from "@/lib/roles";

type NavLink = { href: string; label: string; anyOf?: string[] };

// The menu is grouped by department; each link shows only to users holding
// one of its permissions (pages and actions enforce the same permissions
// server-side).
const GROUPS: { key: string; label: string; links: NavLink[] }[] = [
  {
    key: "operations",
    label: "Operations",
    links: [
      { href: "/service-requests", label: "Service Requests", anyOf: ["requests.manage", "requests.approve"] },
      { href: "/jobs", label: "Jobs / Cases", anyOf: ["jobs.view"] },
      { href: "/cases", label: "Tax & Immigration Cases", anyOf: ["jobs.view"] },
      { href: "/reminders", label: "Follow-ups & Alerts", anyOf: ["jobs.view"] },
      { href: "/shipments", label: "Shipments", anyOf: ["shipments.manage"] },
      { href: "/agencies", label: "Government Agencies", anyOf: ["jobs.view", "agencies.manage"] },
    ],
  },
  {
    key: "crm",
    label: "Clients & Sales",
    links: [
      { href: "/clients", label: "Clients", anyOf: ["clients.view"] },
      { href: "/quotes", label: "Quotes", anyOf: ["quotes.manage"] },
    ],
  },
  {
    key: "finance",
    label: "Finance",
    links: [
      { href: "/finance", label: "Finance Overview", anyOf: ["finance.view"] },
      { href: "/invoices", label: "Invoices", anyOf: ["invoices.view"] },
      { href: "/finance/advances", label: "Client Advances", anyOf: ["finance.view", "payments.record"] },
      { href: "/expenses", label: "Expenses", anyOf: ["expenses.view"] },
      { href: "/finance/bills", label: "Supplier Bills", anyOf: ["finance.view", "bills.manage"] },
      { href: "/finance/reports/profit-loss", label: "Financial Reports", anyOf: ["reports.financial"] },
      { href: "/reports", label: "Profitability", anyOf: ["reports.operational"] },
      { href: "/accounting", label: "Accounting", anyOf: ["reports.financial"] },
    ],
  },
  {
    key: "purchasing",
    label: "Purchasing",
    links: [
      { href: "/purchase-requests", label: "Purchase Requests", anyOf: ["purchases.manage", "purchases.approve"] },
      { href: "/vendors", label: "Vendors", anyOf: ["vendors.manage"] },
    ],
  },
  {
    key: "admin",
    label: "Administration",
    links: [
      { href: "/services", label: "Service Catalog", anyOf: ["catalog.manage"] },
      { href: "/users", label: "Users & Roles", anyOf: ["users.manage"] },
      { href: "/settings", label: "Settings", anyOf: ["settings.manage"] },
      { href: "/audit", label: "Audit Trail", anyOf: ["audit.view"] },
      { href: "/ministries", label: "Tax Exemption Registry", anyOf: ["__admin__"] },
      { href: "/ministry", label: "Tax Exemption Queue", anyOf: ["__admin__"] },
      { href: "/deliveries", label: "Deliveries", anyOf: ["__admin__"] },
    ],
  },
];

const DASHBOARD: NavLink = { href: "/", label: "Dashboard", anyOf: ["jobs.view", "finance.view", "invoices.view", "expenses.view", "clients.view"] };

// Roles scoped to the ministry-clearance module get a focused menu instead
// of the full internal ops app (which shows every client's data).
const roleLinks: Partial<Record<Role, NavLink[]>> = {
  MINISTRY_REGISTRAR: [{ href: "/ministries", label: "Tax Exemption Registry" }],
  MINISTRY_OFFICER: [{ href: "/ministry", label: "Tax Exemption Queue" }],
  VENDOR: [{ href: "/my-shipments", label: "My Shipments" }],
  LOGISTICS_STAFF: [{ href: "/deliveries", label: "Deliveries" }],
};

const STORAGE_KEY = "portsimex.nav.open";
const CHANGE_EVENT = "portsimex-nav-change";

// Expanded departments live in localStorage (per browser); reads and
// writes are guarded because storage can be blocked (private browsing).
function readOpen(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}
function writeOpen(keys: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // ignore -- the menu still works, it just won't be remembered
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
function subscribeOpen(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
function parseOpen(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function linkClass(active: boolean, nested = false) {
  return `block rounded-md ${nested ? "py-1.5 pl-6 pr-3" : "px-3 py-2"} text-sm font-medium transition-colors ${
    active ? "bg-brand-600 text-white" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
  }`;
}

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
  const allowed = (l: NavLink) => fullAccess || !l.anyOf || l.anyOf.some((p) => permissions.includes(p));
  const groups = GROUPS.map((g) => ({ ...g, links: g.links.filter(allowed) })).filter((g) => g.links.length > 0);
  const all = groups.flatMap((g) => g.links);

  // The most specific matching link wins (/finance/bills over /finance).
  const matches = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  const isActive = (href: string) =>
    matches(href) && !all.some((o) => o.href.length > href.length && o.href.startsWith(href) && matches(o.href));
  const activeGroup = groups.find((g) => g.links.some((l) => isActive(l.href)))?.key;

  // Which departments are expanded: remembered in this browser; the current
  // page's department always opens.
  const raw = useSyncExternalStore(subscribeOpen, readOpen, () => "[]");
  const open = parseOpen(raw);
  const toggle = (key: string) => writeOpen(open.includes(key) ? open.filter((k) => k !== key) : [...open, key]);

  const portal = roleLinks[role];
  if (portal) {
    return (
      <nav className="flex flex-col gap-1">
        {portal.map((item) => (
          <Link key={item.href} href={item.href} onClick={onNavigate} className={linkClass(matches(item.href))}>
            {item.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-1">
      {allowed(DASHBOARD) && (
        <Link href="/" onClick={onNavigate} className={linkClass(pathname === "/")}>
          Dashboard
        </Link>
      )}
      {groups.map((g) => {
        // A department with a single page is just a link.
        if (g.links.length === 1) {
          const l = g.links[0];
          return (
            <Link key={g.key} href={l.href} onClick={onNavigate} className={linkClass(isActive(l.href))}>
              {l.label}
            </Link>
          );
        }
        const expanded = open.includes(g.key) || activeGroup === g.key;
        return (
          <div key={g.key}>
            <button
              type="button"
              onClick={() => toggle(g.key)}
              aria-expanded={expanded}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-semibold transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                activeGroup === g.key ? "text-brand-700 dark:text-brand-300" : "text-zinc-800 dark:text-zinc-200"
              }`}
            >
              <span>{g.label}</span>
              <span className="flex items-center gap-2 text-xs font-normal text-zinc-400">
                {!expanded && g.links.length}
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className={`transition-transform ${expanded ? "rotate-90" : ""}`}>
                  <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </span>
            </button>
            {expanded && (
              <div className="mt-0.5 flex flex-col gap-0.5">
                {g.links.map((l) => (
                  <Link key={l.href} href={l.href} onClick={onNavigate} className={linkClass(isActive(l.href), true)}>
                    {l.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
