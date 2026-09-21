"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useSession } from "@/auth/session-context";
import { logout as logoutAction } from "@/features/accounts/actions";
import { BottomDock, BrandLink, Button, SkipLink } from "@/shared/ui";

/** Fixed 5-tab portal chrome (A18) — workers hold no catalog grants. */
const PORTAL_DOCK = [
  { label: "Home", href: "/portal", tooltip: "Your portal home", icon: "home" as const },
  { label: "Offers", href: "/portal/offers", tooltip: "Accept or decline a placement", icon: "offers" as const },
  { label: "Pay", href: "/portal/pay-statements", tooltip: "Pay statements", icon: "pay" as const },
  { label: "Profile", href: "/portal/me", tooltip: "Your profile", icon: "profile" as const },
  { label: "Documents", href: "/portal/documents", tooltip: "Your uploads", icon: "docs" as const },
];

const PORTAL_MORE = [
  { label: "My shifts", href: "/portal/shifts", tooltip: "Shifts on placements you confirmed" },
  { label: "Signatures", href: "/portal/signatures", tooltip: "Forms waiting for your signature" },
  { label: "Availability", href: "/portal/availability", tooltip: "When you can work" },
  { label: "Onboarding", href: "/portal/onboarding", tooltip: "Submit intake to the office" },
];

export function PortalShell({ children }: { children: ReactNode }) {
  const { session, clear } = useSession();
  const router = useRouter();

  if (!session) return null;

  async function handleLogout() {
    try {
      await logoutAction();
    } catch {
      // Still leave the UI even if the API rejected the POST (e.g. CSRF).
    }
    clear();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      <header className="flex items-center justify-between px-6 py-5">
        <BrandLink href="/portal" />
        <p className="hidden max-w-[40%] truncate font-fine text-[11px] text-cadence-ink/65 sm:block">
          Worker portal · {session.user.login}
        </p>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 overflow-x-hidden px-3 pb-28 sm:px-8"
      >
        {children}
      </main>
      <BottomDock
        items={PORTAL_DOCK}
        overflow={PORTAL_MORE}
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
