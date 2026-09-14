"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { Tooltip } from "@/shared/ui/Tooltip";

export interface DockItem {
  label: string;
  href: string;
  tooltip?: string;
}

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" strokeLinejoin="round" />
    </svg>
  );
}

function IconPeople() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.2" />
      <path d="M16 14.5c2.2.3 3.8 1.6 4.4 4.5" strokeLinecap="round" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconPerson() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 19.5c.8-3.4 3.4-5 7-5s6.2 1.6 7 5" strokeLinecap="round" />
    </svg>
  );
}

const ICONS = [IconHome, IconPeople, IconClock, IconPerson] as const;

function pathActive(pathname: string, href: string) {
  if (href === "/" || href === "/portal") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomDock({
  items,
  overflow,
  footer,
}: {
  items: DockItem[];
  overflow?: DockItem[];
  footer?: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const overflowActive = (overflow ?? []).some((item) => pathActive(pathname, item.href));

  return (
    <>
      {open && overflow && overflow.length > 0 ? (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}>
          <div
            className="absolute bottom-24 left-1/2 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 rounded-[1.75rem] bg-card p-3 text-on-card shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <ul className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
              {overflow.map((item) => {
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
            {footer ? <div className="mt-2 border-t border-white/10 pt-3">{footer}</div> : null}
          </div>
        </div>
      ) : null}

      <nav className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom,0px))] z-50 flex justify-center px-4">
        <ul className="pointer-events-auto flex items-center gap-1 overflow-visible rounded-full bg-card p-1.5 shadow-card">
          {items.slice(0, 3).map((item, index) => {
            const Icon = ICONS[index] ?? IconHome;
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
          {overflow && overflow.length > 0 ? (
            <li>
              <Tooltip content="More modules">
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
                  <IconPerson />
                  <span className="sr-only">More</span>
                </button>
              </Tooltip>
            </li>
          ) : items[3] ? (
            <li>
              <Tooltip content={items[3].tooltip ?? items[3].label}>
                <Link
                  href={items[3].href}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-full transition-colors",
                    pathActive(pathname, items[3].href)
                      ? "bg-cadence-yellow text-cadence-ink"
                      : "text-on-card hover:bg-white/10",
                  )}
                >
                  <IconPerson />
                  <span className="sr-only">{items[3].label}</span>
                </Link>
              </Tooltip>
            </li>
          ) : null}
        </ul>
      </nav>
    </>
  );
}
