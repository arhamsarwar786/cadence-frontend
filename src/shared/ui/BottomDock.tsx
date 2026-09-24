"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { useBodyScrollLock } from "@/shared/lib/use-body-scroll-lock";
import { BrandMark } from "@/shared/ui/Brand";
import { Tooltip } from "@/shared/ui/Tooltip";
import {
  STAFF_NAV_GROUP_LABELS,
  STAFF_NAV_GROUP_ORDER,
  type StaffNavGroup,
  type StaffNavItem,
} from "@/permissions/staff-nav";

export interface DockItem {
  label: string;
  href: string;
  tooltip?: string;
  icon?: "home" | "payroll" | "employees" | "clients" | "more" | "offers" | "shifts" | "pay" | "profile" | "docs";
}

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" strokeLinejoin="round" />
    </svg>
  );
}

function IconPayroll() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 3v18M16 7.5c0-1.7-1.8-3-4-3s-4 1.3-4 3 1.8 2.5 4 3 4 1.4 4 3-1.8 3-4 3-4-1.3-4-3" strokeLinecap="round" />
    </svg>
  );
}

function IconEmployees() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 19.5c.8-3.4 3.4-5 7-5s6.2 1.6 7 5" strokeLinecap="round" />
    </svg>
  );
}

function IconClients() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 20V8.5L12 4l8 4.5V20" strokeLinejoin="round" />
      <path d="M9 20v-5h6v5" strokeLinejoin="round" />
      <path d="M9 11h.01M12 11h.01M15 11h.01" strokeLinecap="round" />
    </svg>
  );
}

function IconMore() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="4" y="4" width="6" height="6" rx="1.2" />
      <rect x="14" y="4" width="6" height="6" rx="1.2" />
      <rect x="4" y="14" width="6" height="6" rx="1.2" />
      <rect x="14" y="14" width="6" height="6" rx="1.2" />
    </svg>
  );
}

function IconBriefcase() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function IconDocs() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" strokeLinejoin="round" />
      <path d="M14 3v5h5M9 13h6M9 17h4" strokeLinecap="round" />
    </svg>
  );
}

const ICON_MAP = {
  home: IconHome,
  payroll: IconPayroll,
  employees: IconEmployees,
  clients: IconClients,
  more: IconMore,
  offers: IconBriefcase,
  shifts: IconBriefcase,
  pay: IconPayroll,
  profile: IconEmployees,
  docs: IconDocs,
} as const;

function pathActive(pathname: string, href: string) {
  if (href === "/" || href === "/portal") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomDock({
  items,
  overflow,
  overflowGroups,
  footer,
  showLogo,
  notificationDot,
  align = "center",
}: {
  items: DockItem[];
  /** Flat overflow (portal). Prefer overflowGroups for staff More overlay. */
  overflow?: DockItem[];
  overflowGroups?: Partial<Record<StaffNavGroup, StaffNavItem[]>>;
  footer?: ReactNode;
  showLogo?: boolean;
  notificationDot?: boolean;
  align?: "center" | "start";
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const groupedEntries = overflowGroups
    ? STAFF_NAV_GROUP_ORDER.map((group) => ({
        group,
        items: (overflowGroups[group] ?? []).filter(Boolean),
      })).filter((entry) => entry.items.length > 0)
    : [];

  const flatOverflow = overflow ?? [];
  const hasOverflow = groupedEntries.length > 0 || flatOverflow.length > 0;
  useBodyScrollLock(open && hasOverflow);
  const overflowActive =
    groupedEntries.some((entry) => entry.items.some((item) => pathActive(pathname, item.href))) ||
    flatOverflow.some((item) => pathActive(pathname, item.href));

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {open && hasOverflow ? (
        <div
          className="fixed inset-0 z-40 touch-none bg-cadence-ink/25"
          onClick={() => setOpen(false)}
        >
          <div
            className={cn(
              "absolute bottom-24 w-[min(22rem,calc(100vw-2rem))] rounded-[1.75rem] bg-card p-4 text-on-card shadow-card",
              align === "start"
                ? "left-1/2 -translate-x-1/2 sm:left-6 sm:translate-x-0"
                : "left-1/2 -translate-x-1/2",
            )}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-label="More modules"
          >
            {groupedEntries.length > 0 ? (
              <div className="scroll-area-y flex max-h-[min(28rem,70dvh)] flex-col gap-4">
                {groupedEntries.map(({ group, items: groupItems }) => (
                  <div key={group}>
                    <p className="mb-1.5 px-2 font-subheading text-[10px] uppercase tracking-[0.18em] text-on-card-muted">
                      {STAFF_NAV_GROUP_LABELS[group]}
                    </p>
                    <ul className="flex flex-col gap-0.5">
                      {groupItems.map((item) => {
                        const active = pathActive(pathname, item.href);
                        return (
                          <li key={item.href}>
                            <Tooltip content={item.tooltip} className="w-full">
                              <Link
                                href={item.href}
                                onClick={() => setOpen(false)}
                                className={cn(
                                  "block rounded-full px-4 py-2.5 font-body text-sm",
                                  active
                                    ? "bg-cadence-yellow text-cadence-ink"
                                    : "text-on-card hover:bg-white/5",
                                )}
                              >
                                {item.label}
                              </Link>
                            </Tooltip>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <ul className="scroll-area-y flex max-h-[min(18rem,50dvh)] flex-col gap-0.5">
                {flatOverflow.map((item) => {
                  const active = pathActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Tooltip content={item.tooltip ?? item.label} className="w-full">
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "block rounded-full px-4 py-2.5 font-body text-sm",
                            active ? "bg-cadence-yellow text-cadence-ink" : "text-on-card hover:bg-white/5",
                          )}
                        >
                          {item.label}
                        </Link>
                      </Tooltip>
                    </li>
                  );
                })}
              </ul>
            )}
            {footer ? <div className="mt-3 border-t border-white/10 pt-3">{footer}</div> : null}
          </div>
        </div>
      ) : null}

      <nav
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom,0px))] z-50 flex px-4",
          align === "start" ? "justify-center sm:justify-start sm:px-6" : "justify-center",
        )}
      >
        <ul className="pointer-events-auto flex items-center gap-1 overflow-visible rounded-full bg-card p-1.5 text-on-card shadow-card">
          {showLogo ? (
            <li>
              <Tooltip content="Dashboard">
                <Link
                  href="/"
                  className={cn(
                    "relative flex h-11 w-11 items-center justify-center rounded-full transition-colors",
                    pathActive(pathname, "/")
                      ? "bg-cadence-yellow text-cadence-ink"
                      : "text-on-card hover:bg-white/10",
                  )}
                >
                  <BrandMark className="h-6 w-auto" />
                  {notificationDot ? (
                    <span
                      className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-cadence-orange"
                      aria-label="Unread notifications"
                    />
                  ) : null}
                  <span className="sr-only">Dashboard</span>
                </Link>
              </Tooltip>
            </li>
          ) : null}
          {items.map((item) => {
            const Icon = ICON_MAP[item.icon ?? "home"] ?? IconHome;
            const active = pathActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Tooltip content={item.tooltip ?? item.label}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-full transition-colors",
                      active ? "bg-cadence-yellow text-cadence-ink" : "text-on-card hover:bg-white/10",
                    )}
                  >
                    <Icon />
                    <span className="sr-only">{item.label}</span>
                  </Link>
                </Tooltip>
              </li>
            );
          })}
          {hasOverflow ? (
            <li>
              <Tooltip content="More">
                <button
                  type="button"
                  onClick={() => setOpen((value) => !value)}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-full transition-colors",
                    open || overflowActive
                      ? "bg-cadence-yellow text-cadence-ink"
                      : "text-on-card hover:bg-white/10",
                  )}
                >
                  <IconMore />
                  <span className="sr-only">More</span>
                </button>
              </Tooltip>
            </li>
          ) : null}
        </ul>
      </nav>
    </>
  );
}
