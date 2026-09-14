import type { CurrentUser } from "@/features/accounts/types";
import { hasAnyPerm, hasPerm } from "@/permissions/has-perm";
import { PERM, type PermissionKey } from "@/permissions/keys";

export interface StaffNavItem {
  label: string;
  href: string;
  tooltip: string;
  /** Root always passes; otherwise ANY one of these keys shows the item. */
  anyOf: readonly PermissionKey[];
  /** Root-only, no catalog key (org settings — ARCHITECTURE.md §6/§7). */
  rootOnly?: boolean;
  /** Table exists in ARCHITECTURE.md §6/§7 but the backend door doesn't
   * exist yet (or the screen is explicitly deferred) — never rendered,
   * kept here so the nav model stays a complete, honest read of the doc. */
  built: boolean;
}

/** Section order and gating key(s) straight from ARCHITECTURE.md §6.
 * Missing permission -> omit the item, never a disabled/greyed one
 * ("Missing permission -> omit the nav item"). */
export const STAFF_NAV_ITEMS: readonly StaffNavItem[] = [
  {
    label: "Clients",
    href: "/clients",
    tooltip: "Companies you staff",
    anyOf: [PERM.CLIENTS_VIEW],
    built: true,
  },
  {
    label: "Workers",
    href: "/workers",
    tooltip: "People you place on jobs",
    anyOf: [PERM.WORKERS_VIEW],
    built: true,
  },
  {
    label: "Jobs",
    href: "/jobs",
    tooltip: "Roles at a client site",
    anyOf: [PERM.JOBS_VIEW],
    built: true,
  },
  {
    label: "Shifts",
    href: "/shifts",
    tooltip: "Scheduled work windows",
    anyOf: [PERM.SHIFTS_VIEW],
    built: true,
  },
  {
    label: "Hour sheets",
    href: "/hour-sheets",
    tooltip: "Hours submitted for a job",
    anyOf: [PERM.HOURSHEETS_VIEW],
    built: true,
  },
  {
    label: "Invoices",
    href: "/invoices",
    tooltip: "Bills sent to clients",
    anyOf: [PERM.CLIENTS_INVOICE_CREATE, PERM.CLIENTS_INVOICE_APPROVE, PERM.INVOICES_SEND],
    built: true,
  },
  {
    label: "Pay statements",
    href: "/payroll",
    tooltip: "Worker pay runs and statements",
    anyOf: [PERM.PAYROLL_PAGE_VIEW],
    built: true,
  },
  {
    label: "Documents",
    href: "/documents",
    tooltip: "Files held for workers and jobs",
    anyOf: [PERM.DOCUMENTS_VIEW],
    built: true,
  },
  {
    label: "E-sign",
    href: "/esign",
    tooltip: "Signature requests the office sent",
    anyOf: [PERM.ESIGN_STATUS_VIEW],
    built: true,
  },
  {
    label: "Tasks",
    href: "/tasks",
    tooltip: "Follow-ups for this office",
    anyOf: [PERM.TASKS_VIEW],
    built: true,
  },
  {
    label: "Privacy",
    href: "/privacy",
    tooltip: "Access and deletion requests",
    anyOf: [PERM.PRIVACY_REQUESTS_VIEW],
    built: true,
  },
  {
    label: "Candidate imports",
    href: "/candidate-imports",
    tooltip: "Bulk worker intake batches",
    anyOf: [PERM.CANDIDATE_IMPORTS_VIEW],
    built: true,
  },
  {
    label: "Notifications",
    href: "/notifications/templates",
    tooltip: "Message templates the office sends",
    anyOf: [PERM.NOTIFICATIONS_TEMPLATES_MANAGE],
    built: true,
  },
  // Blocked on a backend door that doesn't exist yet — see context.md
  // (2026-09-09 session contract entry) and ARCHITECTURE.md §7.
  {
    label: "Admin users",
    href: "/admin/users",
    tooltip: "Staff accounts for this office",
    anyOf: [PERM.ADMIN_USERS_VIEW],
    built: false,
  },
  {
    label: "Audit",
    href: "/audit",
    tooltip: "Who changed what, and when",
    anyOf: [PERM.AUDIT_LOG_VIEW],
    built: false,
  },
  // Catalog-only per ARCHITECTURE.md §6 — no dashboard in the first build.
  {
    label: "Reporting",
    href: "/reports",
    tooltip: "Office-wide reports",
    anyOf: [PERM.REPORTS_DASHBOARD_VIEW],
    built: false,
  },
  {
    label: "Settings",
    href: "/settings",
    tooltip: "Consent copy and office settings",
    anyOf: [],
    rootOnly: true,
    built: true,
  },
] as const;

export function visibleStaffNavItems(user: CurrentUser): StaffNavItem[] {
  return STAFF_NAV_ITEMS.filter((item) => {
    if (!item.built) return false;
    if (item.rootOnly) return user.is_root;
    return user.is_root || hasAnyPerm(user, item.anyOf);
  });
}

export { hasPerm };
