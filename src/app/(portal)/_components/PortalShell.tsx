"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useSession } from "@/auth/session-context";
import { logout as logoutAction } from "@/features/accounts/actions";
import { BottomDock, BrandLink, Button, SkipLink } from "@/shared/ui";

/** Fixed portal chrome (ARCHITECTURE.md §2.4) — workers hold no catalog
 * grants, so this nav is identity-only, not permission-computed. */
const PORTAL_NAV_ITEMS = [
  { label: "Home", href: "/portal", tooltip: "Your portal home" },
  { label: "My profile", href: "/portal/me", tooltip: "Your contact details and history" },
  { label: "Onboarding", href: "/portal/onboarding", tooltip: "Submit intake to the office" },
  { label: "Offers", href: "/portal/offers", tooltip: "Accept or decline a placement" },
  { label: "My shifts", href: "/portal/shifts", tooltip: "Shifts on placements you confirmed" },
  { label: "Pay statements", href: "/portal/payslips", tooltip: "Issued and paid statements" },
  { label: "Signatures", href: "/portal/signatures", tooltip: "Forms waiting for your signature" },
  { label: "Availability", href: "/portal/availability", tooltip: "When you can work" },
  { label: "Documents", href: "/portal/documents", tooltip: "Files you uploaded" },
  { label: "Consent", href: "/portal/consent", tooltip: "Privacy notice and re-consent" },
] as const;

export function PortalShell({ children }: { children: ReactNode }) {
  const { session, clear } = useSession();
  const router = useRouter();

  if (!session) return null;

  async function handleLogout() {
    await logoutAction();
    clear();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      <header className="flex items-center justify-between px-6 py-5">
        <BrandLink href="/portal" />
        <p className="hidden max-w-[40%] truncate font-fine text-[11px] text-cadence-ink/45 sm:block">
          Worker portal · {session.user.login}
        </p>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 sm:px-8"
      >
        {children}
      </main>
      <BottomDock
        items={PORTAL_NAV_ITEMS.filter((item) =>
          ["/portal", "/portal/shifts", "/portal/payslips"].includes(item.href),
        ).map(({ label, href, tooltip }) => ({ label, href, tooltip }))}
        overflow={PORTAL_NAV_ITEMS.filter(
          (item) => !["/portal", "/portal/shifts", "/portal/payslips"].includes(item.href),
        ).map(({ label, href, tooltip }) => ({ label, href, tooltip }))}
        footer={
          <div>
            <p className="mb-2 truncate px-2 font-fine text-[11px] text-on-card-muted">
              {session.user.login}
            </p>
            <Button
              variant="inverse"
              size="sm"
              className="w-full"
              tooltip="Sign out of the worker portal"
              onClick={handleLogout}
            >
              Log out
            </Button>
          </div>
        }
      />
    </div>
  );
}
