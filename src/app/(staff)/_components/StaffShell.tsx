"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useSession } from "@/auth/session-context";
import { logout as logoutAction } from "@/features/accounts/actions";
import { visibleStaffNavItems } from "@/permissions/staff-nav";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui";

/** Grant-driven sidebar (ARCHITECTURE.md §2.4/§6). Root sees every item;
 * everyone else sees only what visibleStaffNavItems computes from their
 * own grants — missing permission omits the item, it is never shown
 * disabled. */
export function StaffShell({ children }: { children: ReactNode }) {
  const { session, clear } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  // RequireStaff (the layout's own wrapper) already gates on session; this
  // is a defensive fallback, never the real check.
  if (!session) return null;

  const navItems = visibleStaffNavItems(session.user);

  async function handleLogout() {
    await logoutAction();
    clear();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface-muted">
        <div className="px-4 py-5">
          <span className="font-heading text-2xl text-cadence-ink">Cadence</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-2">
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "block rounded-md px-3 py-2 font-body text-sm transition-colors",
                      active
                        ? "bg-cadence-red text-white"
                        : "text-cadence-ink hover:bg-surface",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-border p-3">
          <p className="mb-2 truncate font-body text-xs text-cadence-ink/60">
            {session.user.login}
          </p>
          <Button variant="secondary" size="sm" className="w-full" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-background px-8 py-6">{children}</main>
    </div>
  );
}
