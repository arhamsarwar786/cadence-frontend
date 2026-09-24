"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useSession } from "@/auth/session-context";
import { logout as logoutAction } from "@/features/accounts/actions";
import {
  dockStaffNavItems,
  moreStaffNavItems,
  STAFF_NAV_GROUP_ORDER,
  type StaffNavGroup,
  type StaffNavItem,
} from "@/permissions/staff-nav";
import { BottomDock, Button, SkipLink } from "@/shared/ui";

const DOCK_ICONS: Record<string, "payroll" | "employees" | "clients"> = {
  "/payroll": "payroll",
  "/workers": "employees",
  "/clients": "clients",
};

/** Grant-driven chrome. Root sees every built item; everyone else sees
 * only what their grants unlock — missing permission omits the item. */
export function StaffShell({ children }: { children: ReactNode }) {
  const { session, clear } = useSession();
  const router = useRouter();

  if (!session) return null;

  const dock = dockStaffNavItems(session.user);
  const more = moreStaffNavItems(session.user);
  const overflowGroups = STAFF_NAV_GROUP_ORDER.reduce(
    (acc, group) => {
      const items = more.filter((item) => item.group === group);
      if (items.length) acc[group] = items;
      return acc;
    },
    {} as Partial<Record<StaffNavGroup, StaffNavItem[]>>,
  );

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
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full min-w-0 max-w-6xl min-h-0 flex-1 flex-col overflow-hidden px-4 pb-[var(--dock-clearance)] pt-5 sm:px-8 sm:pt-6"
      >
        {children}
      </main>
      <BottomDock
        showLogo
        align="center"
        items={dock.map(({ label, href, tooltip }) => ({
          label,
          href,
          tooltip,
          icon: DOCK_ICONS[href] ?? "home",
        }))}
        overflowGroups={overflowGroups}
        footer={
          <div>
            <p className="mb-2 truncate px-2 font-fine text-[11px] text-on-card-muted">
              {session.user.login}
            </p>
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
