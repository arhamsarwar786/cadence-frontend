import type { CurrentUser } from "@/features/accounts/types";
import { hasAnyPerm, hasPerm } from "@/permissions/has-perm";
import { PERM, type PermissionKey } from "@/permissions/keys";

export type StaffNavGroup = "work" | "money" | "people" | "compliance" | "admin";

export interface StaffNavItem {
  label: string;
  href: string;
  tooltip: string;
  /** Root always passes; otherwise ANY one of these keys shows the item. */
  anyOf: readonly PermissionKey[];
  /** Root-only, no catalog key (org settings). */
  rootOnly?: boolean;
  /**
   * Kept false only when the screen is deferred or the API door is missing.
   * Missing permission omits the item — never greys it out.
   */
  built: boolean;
  /** More-overlay group. Dock primaries still carry a group for Money/People. */
  group: StaffNavGroup;
  /** Primary floating-dock button (Payroll / Employees / Clients). */
  dock?: boolean;
}

export const STAFF_NAV_GROUP_LABELS: Record<StaffNavGroup, string> = {
  work: "Work",
  money: "Money",
  people: "People",
  compliance: "Compliance",
  admin: "Admin",
};

export const STAFF_NAV_GROUP_ORDER: readonly StaffNavGroup[] = [
  "work",
  "money",
  "people",
  "compliance",
  "admin",
];

/** Section order and gating from the product nav decision (2026-09-17). */
export const STAFF_NAV_ITEMS: readonly StaffNavItem[] = [
  {
    label: "Jobs",
    href: "/jobs",
    tooltip: "Roles at a client site",
    anyOf: [PERM.JOBS_VIEW],
    built: true,
    group: "work",
  },
  {
    label: "Shifts",
    href: "/shifts",
    tooltip: "Scheduled work windows",
    anyOf: [PERM.SHIFTS_VIEW],
    built: true,
    group: "work",
  },
  {
    label: "Hour sheets",
    href: "/hour-sheets",
    tooltip: "Hours submitted for a job",
    anyOf: [PERM.HOURSHEETS_VIEW],
    built: true,
    group: "work",
  },
  {
    label: "Invoices",
    href: "/invoices",
    tooltip: "Bills sent to clients",
    anyOf: [PERM.CLIENTS_INVOICE_CREATE, PERM.CLIENTS_INVOICE_APPROVE, PERM.INVOICES_SEND],
    built: true,
    group: "money",
  },
  {
    label: "Credit notes",
    href: "/credit-notes",
    tooltip: "Credits against issued invoices",
    anyOf: [PERM.CLIENTS_VIEW],
    built: true,
    group: "money",
  },
  {
    label: "Payroll runs",
    href: "/payroll",
    tooltip: "Worker pay runs and statements",
    anyOf: [PERM.PAYROLL_PAGE_VIEW],
    built: true,
    group: "money",
    dock: true,
  },
  {
    label: "Perm placements",
    href: "/perm-placements",
    tooltip: "One-time placement fees",
    anyOf: [PERM.CLIENTS_VIEW],
    built: true,
    group: "money",
  },
  {
    label: "Workers",
    href: "/workers",
    tooltip: "People you place on jobs",
    anyOf: [PERM.WORKERS_VIEW],
    built: true,
    group: "people",
    dock: true,
  },
  {
    label: "Candidate imports",
    href: "/candidate-imports",
    tooltip: "Bulk worker intake batches",
    anyOf: [PERM.CANDIDATE_IMPORTS_VIEW],
    built: true,
    group: "people",
  },
  {
    label: "Clients",
    href: "/clients",
    tooltip: "Companies you staff",
    anyOf: [PERM.CLIENTS_VIEW],
    built: true,
    // Dock primary only — not listed in the More overlay groups.
    group: "people",
    dock: true,
  },
  {
    label: "Privacy requests",
    href: "/privacy",
    tooltip: "Access and correction requests",
    anyOf: [PERM.PRIVACY_REQUESTS_VIEW],
    built: true,
    group: "compliance",
  },
  {
    label: "Breach register",
    href: "/privacy/breaches",
    tooltip: "Security-safeguard breach records",
    anyOf: [PERM.PRIVACY_BREACHES_VIEW],
    built: true,
    group: "compliance",
  },
  {
    label: "Disposal schedule",
    href: "/privacy/disposal",
    tooltip: "Scheduled destruction of departed worker records",
    anyOf: [PERM.PRIVACY_DISPOSAL_VIEW],
    built: true,
    group: "compliance",
  },
  {
    label: "Audit log",
    href: "/audit",
    tooltip: "Who changed what, and when",
    anyOf: [PERM.AUDIT_LOG_VIEW],
    built: true,
    group: "compliance",
  },
  {
    label: "Users & permissions",
    href: "/admin/users",
    tooltip: "Staff accounts for this office",
    anyOf: [PERM.ADMIN_USERS_VIEW],
    built: true,
    group: "admin",
  },
  {
    label: "Notification templates",
    href: "/notifications/templates",
    tooltip: "Message templates the office sends",
    anyOf: [PERM.NOTIFICATIONS_TEMPLATES_MANAGE],
    built: true,
    group: "admin",
  },
  {
    label: "E-sign",
    href: "/esign",
    tooltip: "Signature requests the office sent",
    anyOf: [PERM.ESIGN_STATUS_VIEW],
    built: true,
    group: "admin",
  },
  {
    label: "Documents",
    href: "/documents",
    tooltip: "Files held for workers and jobs",
    anyOf: [PERM.DOCUMENTS_VIEW],
    built: true,
    group: "admin",
  },
  {
    label: "Reports",
    href: "/reports",
    tooltip: "Office-wide reports",
    anyOf: [PERM.REPORTS_DASHBOARD_VIEW],
    built: true,
    group: "admin",
  },
  {
    label: "Org settings",
    href: "/settings",
    tooltip: "Agency address, timezone, and onboarding mode",
    anyOf: [PERM.ADMIN_ORG_VIEW],
    built: true,
    group: "admin",
  },
] as const;

export function visibleStaffNavItems(user: CurrentUser): StaffNavItem[] {
  return STAFF_NAV_ITEMS.filter((item) => {
    if (!item.built) return false;
    if (item.rootOnly) return user.is_root;
    return user.is_root || hasAnyPerm(user, item.anyOf);
  });
}

export function dockStaffNavItems(user: CurrentUser): StaffNavItem[] {
  const visible = visibleStaffNavItems(user);
  const order = ["/payroll", "/workers", "/clients"] as const;
  return order
    .map((href) => visible.find((item) => item.href === href && item.dock))
    .filter((item): item is StaffNavItem => Boolean(item));
}

export function moreStaffNavItems(user: CurrentUser): StaffNavItem[] {
  // Clients is dock-only. Payroll and Workers also appear under Money / People.
  const dockOnly = new Set(["/clients"]);
  return visibleStaffNavItems(user).filter((item) => !dockOnly.has(item.href));
}

export { hasPerm };
