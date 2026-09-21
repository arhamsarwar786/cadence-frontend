"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useSession } from "@/auth/session-context";
import { logout as logoutAction } from "@/features/accounts/actions";
import { api } from "@/api/client";
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

  const notifQuery = useQuery({
    queryKey: ["staff-notifications-unread"],
    queryFn: async () => {
      try {
        const data = await api.get<{ count?: number; results?: unknown[] }>(
          "/api/v1/notifications/portal/me/notifications/?page_size=1",
        );
        return data.count ?? data.results?.length ?? 0;
      } catch {
        return 0;
      }
    },
    staleTime: 60_000,
    retry: false,
  });

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
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] pt-5 sm:px-8 sm:pt-6"
      >
        {children}
      </main>
      <BottomDock
        showLogo
        notificationDot={(notifQuery.data ?? 0) > 0}
        align="start"
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
