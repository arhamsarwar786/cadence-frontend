"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useSession } from "@/auth/session-context";
import { logout as logoutAction } from "@/features/accounts/actions";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui";

/** Fixed portal chrome (ARCHITECTURE.md §2.4) — workers hold no catalog
 * grants, so this nav is identity-only, not permission-computed. */
const PORTAL_NAV_ITEMS = [
  { label: "Home", href: "/portal" },
  { label: "My profile", href: "/portal/me" },
  { label: "Onboarding", href: "/portal/onboarding" },
  { label: "Offers", href: "/portal/offers" },
  { label: "My shifts", href: "/portal/shifts" },
  { label: "Pay statements", href: "/portal/payslips" },
  { label: "Signatures", href: "/portal/signatures" },
  { label: "Availability", href: "/portal/availability" },
  { label: "Documents", href: "/portal/documents" },
] as const;

export function PortalShell({ children }: { children: ReactNode }) {
  const { session, clear } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  // RequirePortal already gates on session; defensive fallback only.
  if (!session) return null;

  async function handleLogout() {
    await logoutAction();
    clear();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border bg-surface-muted px-6 py-4">
        <span className="font-heading text-2xl text-cadence-ink">Cadence</span>
        <div className="flex items-center gap-3">
          <span className="font-body text-sm text-cadence-ink/70">{session.user.login}</span>
          <Button variant="secondary" size="sm" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </header>
      <nav className="border-b border-border bg-surface px-6">
        <ul className="flex flex-wrap gap-1 py-2">
          {PORTAL_NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "block rounded-md px-3 py-1.5 font-body text-sm transition-colors",
                    active
                      ? "bg-cadence-red text-white"
                      : "text-cadence-ink hover:bg-surface-muted",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <main className="flex-1 bg-background px-6 py-6">{children}</main>
    </div>
  );
}
