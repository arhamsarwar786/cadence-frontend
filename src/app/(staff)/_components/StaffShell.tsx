"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useSession } from "@/auth/session-context";
import { logout as logoutAction } from "@/features/accounts/actions";
import { visibleStaffNavItems } from "@/permissions/staff-nav";
import { BottomDock, BrandLink, Button, SkipLink } from "@/shared/ui";

/** Grant-driven chrome (ARCHITECTURE.md §2.4/§6). Root sees every item;
 * everyone else sees only what visibleStaffNavItems computes from their
 * own grants — missing permission omits the item, it is never shown
 * disabled. */
export function StaffShell({ children }: { children: ReactNode }) {
  const { session, clear } = useSession();
  const router = useRouter();

  if (!session) return null;

  const navItems = visibleStaffNavItems(session.user);
  const preferredHrefs = ["/workers", "/jobs"];
  const pinned = preferredHrefs
    .map((href) => navItems.find((item) => item.href === href))
    .filter((item): item is (typeof navItems)[number] => Boolean(item));
  const leftover = navItems.filter((item) => !preferredHrefs.includes(item.href));
  const ordered = [...pinned, ...leftover];
  const dockItems = [
    { label: "Home", href: "/", tooltip: "Open tasks for this office" },
    ...ordered.slice(0, 2).map(({ label, href, tooltip }) => ({ label, href, tooltip })),
  ];
  const overflow = ordered.slice(2).map(({ label, href, tooltip }) => ({ label, href, tooltip }));

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
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="flex items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
        <BrandLink href="/" />
        <p className="hidden max-w-[40%] truncate font-fine text-[11px] text-cadence-ink/45 sm:block">
          {session.user.login}
        </p>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] sm:px-8"
      >
        {children}
      </main>
      <BottomDock
        items={dockItems}
        overflow={overflow}
        footer={
          <div>
            <p className="mb-2 truncate px-2 font-fine text-[11px] text-on-card-muted">{session.user.login}</p>
            <Button
              variant="inverse"
              size="sm"
              className="w-full"
              tooltip="Sign out of this office"
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
