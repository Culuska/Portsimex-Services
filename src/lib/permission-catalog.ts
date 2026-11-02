// Granular permissions. Users get them from an access profile (a job title
// such as "Finance Manager" with a configurable set of permissions), not
// from a hard-coded role name. ADMIN / SUPERVISOR are Super Admins and hold
// every permission. Pure module (no app imports) so it is unit tested.

export const PERMISSION_GROUPS = [
  {
    group: "Operations",
    permissions: {
      "requests.manage": "Create and edit service requests",
      "requests.approve": "Approve or reject service requests and open jobs",
      "jobs.view": "View jobs and cases",
      "jobs.manage": "Work on jobs: stages, tasks, documents and case details",
      "jobs.supervise": "Cancel or reopen jobs, skip stages, waive documents",
      "cases.manage": "Record government submissions and follow-ups",
      "clients.view": "View clients",
      "clients.manage": "Add and edit clients, notes and follow-ups",
      "quotes.manage": "Create and send quotations",
      "shipments.manage": "Manage shipments",
      "purchases.manage": "Raise purchase requests",
      "purchases.approve": "Approve or reject purchase requests",
      "vendors.manage": "Add and edit suppliers",
      "agencies.manage": "Manage the government agency directory",
    },
  },
  {
    group: "Finance",
    permissions: {
      "invoices.view": "View invoices",
      "invoices.manage": "Create and issue invoices, set discount and tax",
      "invoices.cancel": "Cancel issued invoices",
      "payments.record": "Record client payments and advances, apply credit",
      "expenses.view": "View expenses",
      "expenses.create": "Record expenses",
      "expenses.approve": "Approve or reject expenses (up to the profile's approval limit)",
      "expenses.pay": "Mark expenses as paid",
      "bills.manage": "Record supplier bills",
      "bills.pay": "Pay supplier bills",
      "payments.authorize": "Authorize payments and refunds above the authorization threshold",
      "finance.view": "View the finance overview, advances and supplier bills",
      "finance.refunds": "Refund client advances",
      "finance.banking": "Manage bank / cash accounts and transfers",
      "finance.journal": "Post journal entries and add ledger accounts",
      "reports.financial": "Financial statements, accounting and ledger",
      "reports.operational": "Profitability and operational reports",
    },
  },
  {
    group: "Administration",
    permissions: {
      "catalog.manage": "Edit the service catalog and workflows",
      "users.manage": "Manage users, roles and permissions",
      "settings.manage": "Change approval limits and security settings",
      "audit.view": "View the audit trail",
    },
  },
] as const;

type Groups = (typeof PERMISSION_GROUPS)[number]["permissions"];
// Distributes over the groups, so this is the union of every group's keys.
type KeysOf<T> = T extends unknown ? keyof T & string : never;
export type Permission = KeysOf<Groups>;

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => Object.keys(g.permissions)) as Permission[];
export const PERMISSION_LABELS = Object.fromEntries(PERMISSION_GROUPS.flatMap((g) => Object.entries(g.permissions))) as Record<Permission, string>;

export function isPermission(p: string): p is Permission {
  return (ALL_PERMISSIONS as string[]).includes(p);
}

export type JobCategory = "LOGISTICS" | "TRANSPORT" | "GOVERNMENT_TAX" | "VEHICLE" | "IMMIGRATION" | "COMMUNICATION" | "OTHER";

export type ProfileTemplate = {
  key: string;
  name: string;
  description: string;
  permissions: Permission[];
  /** Service categories whose jobs this profile works on (empty = all). */
  jobCategories: JobCategory[];
  /** Only jobs the user is responsible for or has tasks on. */
  assignedJobsOnly: boolean;
  /** Highest expense this profile may approve (null = no limit). */
  approvalLimit: number | null;
};

const VIEW: Permission[] = ["jobs.view", "clients.view", "invoices.view", "expenses.view"];
const OFFICER: Permission[] = ["requests.manage", "jobs.view", "jobs.manage", "clients.view", "quotes.manage", "expenses.view", "expenses.create"];
const ALL_OPS: Permission[] = [
  "requests.manage",
  "requests.approve",
  "jobs.view",
  "jobs.manage",
  "jobs.supervise",
  "cases.manage",
  "clients.view",
  "clients.manage",
  "quotes.manage",
  "shipments.manage",
  "purchases.manage",
  "purchases.approve",
  "vendors.manage",
  "agencies.manage",
];

// What a STAFF user could do before access profiles existed -- kept for
// staff accounts that haven't been given a profile yet, so nobody loses
// access when this is deployed.
export const LEGACY_STAFF_PERMISSIONS: Permission[] = [
  "requests.manage",
  "jobs.view",
  "jobs.manage",
  "cases.manage",
  "clients.view",
  "clients.manage",
  "quotes.manage",
  "shipments.manage",
  "purchases.manage",
  "vendors.manage",
  "invoices.view",
  "invoices.manage",
  "invoices.cancel",
  "payments.record",
  "expenses.view",
  "expenses.create",
  "expenses.pay",
  "bills.manage",
  "bills.pay",
  "finance.view",
];

export const DEFAULT_PROFILES: ProfileTemplate[] = [
  {
    key: "general-manager",
    name: "General Manager",
    description: "All operations, approvals and management reports",
    permissions: [
      ...ALL_OPS,
      "invoices.view",
      "invoices.manage",
      "invoices.cancel",
      "payments.record",
      "expenses.view",
      "expenses.create",
      "expenses.approve",
      "expenses.pay",
      "bills.manage",
      "bills.pay",
      "payments.authorize",
      "finance.view",
      "finance.refunds",
      "reports.financial",
      "reports.operational",
      "catalog.manage",
      "audit.view",
    ],
    jobCategories: [],
    assignedJobsOnly: false,
    approvalLimit: null,
  },
  {
    key: "operations-manager",
    name: "Operations Manager",
    description: "Jobs, logistics, transport, customs, rentals, immigration and communication",
    permissions: [...ALL_OPS, "invoices.view", "expenses.view", "expenses.create", "expenses.approve", "reports.operational", "catalog.manage"],
    jobCategories: [],
    assignedJobsOnly: false,
    approvalLimit: 2000,
  },
  {
    key: "logistics-officer",
    name: "Logistics Officer",
    description: "Logistics and transport operations",
    permissions: [...OFFICER, "shipments.manage", "vendors.manage", "purchases.manage"],
    jobCategories: ["LOGISTICS", "TRANSPORT"],
    assignedJobsOnly: false,
    approvalLimit: null,
  },
  {
    key: "customs-tax-officer",
    name: "Customs / Tax Officer",
    description: "Customs clearance and tax exemption cases",
    permissions: [...OFFICER, "cases.manage", "agencies.manage"],
    jobCategories: ["GOVERNMENT_TAX", "LOGISTICS"],
    assignedJobsOnly: false,
    approvalLimit: null,
  },
  {
    key: "immigration-officer",
    name: "Immigration Officer",
    description: "Immigration cases",
    permissions: [...OFFICER, "cases.manage", "agencies.manage"],
    jobCategories: ["IMMIGRATION"],
    assignedJobsOnly: false,
    approvalLimit: null,
  },
  {
    key: "fleet-officer",
    name: "Fleet / Rental Officer",
    description: "Vehicles and rentals",
    permissions: [...OFFICER, "vendors.manage"],
    jobCategories: ["VEHICLE"],
    assignedJobsOnly: false,
    approvalLimit: null,
  },
  {
    key: "communication-officer",
    name: "Communication Officer",
    description: "SIM and telecom services",
    permissions: [...OFFICER, "vendors.manage"],
    jobCategories: ["COMMUNICATION"],
    assignedJobsOnly: false,
    approvalLimit: null,
  },
  {
    key: "finance-manager",
    name: "Finance Manager",
    description: "Invoices, payments, expenses, accounting and financial reports",
    permissions: [
      "jobs.view",
      "clients.view",
      "quotes.manage",
      "vendors.manage",
      "invoices.view",
      "invoices.manage",
      "invoices.cancel",
      "payments.record",
      "expenses.view",
      "expenses.create",
      "expenses.approve",
      "expenses.pay",
      "bills.manage",
      "bills.pay",
      "payments.authorize",
      "finance.view",
      "finance.refunds",
      "finance.banking",
      "finance.journal",
      "reports.financial",
      "reports.operational",
      "purchases.approve",
      "audit.view",
    ],
    jobCategories: [],
    assignedJobsOnly: false,
    approvalLimit: null,
  },
  {
    key: "accountant",
    name: "Accountant",
    description: "Financial transactions and reconciliation",
    permissions: [
      "jobs.view",
      "clients.view",
      "vendors.manage",
      "invoices.view",
      "invoices.manage",
      "payments.record",
      "expenses.view",
      "expenses.create",
      "expenses.pay",
      "bills.manage",
      "bills.pay",
      "finance.view",
      "finance.banking",
      "finance.journal",
      "reports.financial",
    ],
    jobCategories: [],
    assignedJobsOnly: false,
    approvalLimit: null,
  },
  {
    key: "operations-staff",
    name: "Operations Staff",
    description: "Their assigned jobs and tasks",
    permissions: ["requests.manage", "jobs.view", "jobs.manage", "cases.manage", "clients.view", "expenses.view", "expenses.create"],
    jobCategories: [],
    assignedJobsOnly: true,
    approvalLimit: null,
  },
  {
    key: "viewer",
    name: "Viewer",
    description: "Read-only access",
    permissions: [...VIEW, "finance.view"],
    jobCategories: [],
    assignedJobsOnly: false,
    approvalLimit: null,
  },
];

// Only the Super Admin holds these -- never a Supervisor or a staff role.
export const SUPER_ADMIN_ONLY: Permission[] = ["users.manage"];

export type Grant = {
  fullAccess: boolean;
  /** The single Super Admin (owner): users, roles and deleting data. */
  superAdmin: boolean;
  permissions: Permission[];
  jobCategories: JobCategory[];
  assignedJobsOnly: boolean;
  approvalLimit: number | null;
};

/**
 * What a user may do: the Super Admin (ADMIN) everything; a Supervisor
 * everything except managing users / roles and deleting data; staff
 * from their access profile (or the legacy staff set when they have none);
 * portal roles (ministry, vendor, logistics) nothing in the back office.
 */
export function grantFor(
  role: string,
  profile: { permissions: string[]; jobCategories: string[]; assignedJobsOnly: boolean; approvalLimit: number | null } | null,
): Grant {
  if (role === "ADMIN") {
    return { fullAccess: true, superAdmin: true, permissions: [...ALL_PERMISSIONS], jobCategories: [], assignedJobsOnly: false, approvalLimit: null };
  }
  const notOwnerOnly = (p: Permission) => !SUPER_ADMIN_ONLY.includes(p);
  if (role === "SUPERVISOR") {
    return { fullAccess: true, superAdmin: false, permissions: ALL_PERMISSIONS.filter(notOwnerOnly), jobCategories: [], assignedJobsOnly: false, approvalLimit: null };
  }
  if (role !== "STAFF") return { fullAccess: false, superAdmin: false, permissions: [], jobCategories: [], assignedJobsOnly: false, approvalLimit: null };
  if (!profile) {
    return { fullAccess: false, superAdmin: false, permissions: [...LEGACY_STAFF_PERMISSIONS], jobCategories: [], assignedJobsOnly: false, approvalLimit: null };
  }
  return {
    fullAccess: false,
    superAdmin: false,
    permissions: profile.permissions.filter(isPermission).filter(notOwnerOnly),
    jobCategories: profile.jobCategories as JobCategory[],
    assignedJobsOnly: profile.assignedJobsOnly,
    approvalLimit: profile.approvalLimit,
  };
}

export function hasPermission(grant: Grant, permission: Permission): boolean {
  if (SUPER_ADMIN_ONLY.includes(permission)) return grant.superAdmin;
  return grant.fullAccess || grant.permissions.includes(permission);
}

/** Whether a user with this grant may work on / see a given job. */
export function canAccessJob(
  grant: Grant,
  userId: string,
  job: { category: string; responsibleId: string | null; taskAssigneeIds: string[] },
): boolean {
  if (grant.fullAccess) return true;
  if (!grant.permissions.includes("jobs.view")) return false;
  if (grant.jobCategories.length > 0 && !grant.jobCategories.includes(job.category as JobCategory)) return false;
  if (grant.assignedJobsOnly) return job.responsibleId === userId || job.taskAssigneeIds.includes(userId);
  return true;
}

/** Expense approval: needs the permission and an approval limit covering the amount. */
export function canApproveAmount(grant: Grant, amount: number): boolean {
  if (!hasPermission(grant, "expenses.approve")) return false;
  return grant.approvalLimit === null || amount <= grant.approvalLimit + 0.005;
}

// Compact layout for the role editor: one row per area, short tick labels.
// The long descriptions above stay as tooltips. Every permission appears
// exactly once, except the Super-Admin-only ones (checked by a unit test).
export type PermissionArea = { area: string; items: [Permission, string][] };
export const PERMISSION_LAYOUT: { group: string; hint: string; areas: PermissionArea[] }[] = [
  {
    group: "Operations",
    hint: "Requests, jobs, clients and purchasing",
    areas: [
      { area: "Service requests", items: [["requests.manage", "Create / edit"], ["requests.approve", "Approve"]] },
      { area: "Jobs", items: [["jobs.view", "View"], ["jobs.manage", "Work on"], ["jobs.supervise", "Supervise"]] },
      { area: "Gov. submissions", items: [["cases.manage", "Record"]] },
      { area: "Clients", items: [["clients.view", "View"], ["clients.manage", "Add / edit"]] },
      { area: "Quotations", items: [["quotes.manage", "Create / send"]] },
      { area: "Shipments", items: [["shipments.manage", "Manage"]] },
      { area: "Purchase requests", items: [["purchases.manage", "Raise"], ["purchases.approve", "Approve"]] },
      { area: "Suppliers", items: [["vendors.manage", "Add / edit"]] },
      { area: "Gov. agencies", items: [["agencies.manage", "Manage"]] },
    ],
  },
  {
    group: "Finance",
    hint: "Invoices, payments, expenses and reports",
    areas: [
      { area: "Invoices", items: [["invoices.view", "View"], ["invoices.manage", "Create / issue"], ["invoices.cancel", "Cancel"]] },
      { area: "Client payments", items: [["payments.record", "Record"], ["payments.authorize", "Authorize large"]] },
      { area: "Expenses", items: [["expenses.view", "View"], ["expenses.create", "Record"], ["expenses.approve", "Approve"], ["expenses.pay", "Pay"]] },
      { area: "Supplier bills", items: [["bills.manage", "Record"], ["bills.pay", "Pay"]] },
      { area: "Finance overview", items: [["finance.view", "View"], ["finance.refunds", "Refund advances"]] },
      { area: "Bank & cash", items: [["finance.banking", "Manage"], ["finance.journal", "Journal entries"]] },
      { area: "Reports", items: [["reports.financial", "Financial"], ["reports.operational", "Profitability"]] },
    ],
  },
  {
    group: "Administration",
    hint: "Users, settings and the audit trail",
    areas: [
      { area: "Service catalog", items: [["catalog.manage", "Edit"]] },
      { area: "Settings", items: [["settings.manage", "Change"]] },
      { area: "Audit trail", items: [["audit.view", "View"]] },
    ],
  },
];
