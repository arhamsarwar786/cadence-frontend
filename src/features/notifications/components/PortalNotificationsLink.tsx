"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import {
  listPortalNotifications,
  NOTIFICATION_POLL_MS,
  notificationKeys,
} from "@/features/notifications/api";
import { IconBell } from "@/features/notifications/components/NotificationBell";
import { badgeCount, collapseInbox } from "@/features/notifications/describe";
import { cn } from "@/shared/lib/cn";
import { Tooltip } from "@/shared/ui";

/** The worker portal header's bell: a link to /portal/notifications with
 * an unread badge. Polls modestly (60s + window focus). */
export function PortalNotificationsLink() {
  const pathname = usePathname();
  const query = useQuery({
    queryKey: notificationKeys.portalList(),
    queryFn: listPortalNotifications,
    refetchInterval: NOTIFICATION_POLL_MS,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const unread = useMemo(
    () => collapseInbox(query.data ?? []).filter((entry) => entry.unread).length,
    [query.data],
  );
  const active = pathname === "/portal/notifications";

  return (
    <Tooltip content={unread > 0 ? `${unread} unread` : "Notifications"}>
      <Link
        href="/portal/notifications"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cadence-ink/10 transition-colors",
          active ? "bg-cadence-yellow text-cadence-ink" : "bg-surface/80 text-cadence-ink hover:bg-surface",
        )}
      >
        <IconBell />
        {unread > 0 ? (
          <span
            aria-hidden
            data-testid="notification-badge"
            className="absolute -right-1 -top-1 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-cadence-orange px-1 font-body text-[10px] font-semibold leading-none text-white"
          >
            {badgeCount(unread)}
          </span>
        ) : null}
      </Link>
    </Tooltip>
  );
}
