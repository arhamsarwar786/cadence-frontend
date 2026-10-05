"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useSession } from "@/auth/session-context";
import { logout as logoutAction } from "@/features/accounts/actions";
import { PortalNotificationsLink } from "@/features/notifications/components/PortalNotificationsLink";
import { PORTAL_DOCK, PORTAL_MORE } from "@/permissions/portal-nav";
import { BottomDock, BrandLink, Button, SkipLink } from "@/shared/ui";

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
    <div
      className="flex h-dvh max-h-dvh flex-col overflow-hidden"
      style={{ ["--toast-offset" as string]: "calc(var(--dock-clearance) + 0.5rem)" }}
    >
      <SkipLink />
      <header className="flex shrink-0 items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
        <BrandLink href="/portal" />
        <div className="flex min-w-0 items-center gap-3">
          <p className="hidden max-w-[16rem] truncate font-fine text-[11px] text-cadence-ink/65 sm:block">
            Worker portal · {session.user.login}
          </p>
          <PortalNotificationsLink />
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full min-w-0 max-w-6xl min-h-0 flex-1 flex-col overflow-hidden px-3 pb-[var(--dock-clearance)] pt-1 sm:px-8"
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
