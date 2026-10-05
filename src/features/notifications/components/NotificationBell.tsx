"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useOrgTimeZone } from "@/auth/use-org-timezone";
import { markMyNotificationsRead } from "@/features/notifications/actions";
import {
  getMyUnreadCount,
  listMyNotifications,
  NOTIFICATION_POLL_MS,
  notificationKeys,
} from "@/features/notifications/api";
import { NotificationList } from "@/features/notifications/components/NotificationList";
import { badgeCount, collapseInbox, type InboxEntry } from "@/features/notifications/describe";
import { cn } from "@/shared/lib/cn";
import { messageFrom } from "@/shared/lib/errors";
import { Button, Dialog, Loading, QueryError, Tooltip, useToast } from "@/shared/ui";

export function IconBell({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path
        d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2H4.5z"
        strokeLinejoin="round"
      />
      <path d="M10 20.5a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The staff shell's bell: a dock button with an unread badge that opens the
 * account's own inbox. The count polls modestly (60s + window focus); the
 * list loads only while the panel is open.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();
  const timeZone = useOrgTimeZone();

  const unreadQuery = useQuery({
    queryKey: notificationKeys.staffUnread(),
    queryFn: getMyUnreadCount,
    refetchInterval: NOTIFICATION_POLL_MS,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const listQuery = useQuery({
    queryKey: notificationKeys.staffList(),
    queryFn: listMyNotifications,
    enabled: open,
    refetchOnWindowFocus: true,
  });

  const unread = unreadQuery.data?.unread ?? 0;
  const entries = useMemo(() => collapseInbox(listQuery.data?.results ?? []), [listQuery.data]);
  const listUnread = entries.filter((entry) => entry.unread).length;

  const markOne = useMutation({
    mutationFn: (entry: InboxEntry) => markMyNotificationsRead(entry.unreadIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
    onError: (error) => toast.error(messageFrom(error)),
  });
  const markAll = useMutation({
    mutationFn: () => markMyNotificationsRead(),
    onSuccess: () => {
      toast.success("All notifications marked read");
      return queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
    onError: (error) => toast.error(messageFrom(error)),
  });

  const label = unread > 0 ? `Notifications, ${unread} unread` : "Notifications";

  return (
    <>
      <Tooltip content={unread > 0 ? `${unread} unread` : "Notifications"}>
        <button
          type="button"
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className={cn(
            "relative flex h-11 w-11 items-center justify-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cadence-yellow",
            open ? "bg-cadence-yellow text-cadence-ink" : "text-on-card hover:bg-white/10",
          )}
        >
          <IconBell />
          {unread > 0 ? (
            <span
              aria-hidden
              data-testid="notification-badge"
              className="absolute right-0.5 top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-cadence-yellow px-1 font-body text-[10px] font-semibold leading-none text-cadence-ink ring-2 ring-card"
            >
              {badgeCount(unread)}
            </span>
          ) : null}
        </button>
      </Tooltip>

      <Dialog open={open} onClose={() => setOpen(false)} title="Notifications">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-body text-sm text-on-card-muted" aria-live="polite">
              {listQuery.isSuccess
                ? listUnread > 0
                  ? `${listUnread} unread`
                  : (listQuery.data?.results.length ?? 0) > 0
                    ? "You're all caught up."
                    : ""
                : "Messages the system sent to you."}
            </p>
            {listUnread > 0 ? (
              <Button
                variant="inverse"
                size="sm"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
              >
                {markAll.isPending ? "Marking…" : "Mark all read"}
              </Button>
            ) : null}
          </div>

          <div className="scroll-area-y max-h-[min(26rem,60dvh)]">
            {listQuery.isLoading ? (
              <Loading label="Loading notifications" />
            ) : listQuery.isError ? (
              <QueryError error={listQuery.error} onRetry={() => listQuery.refetch()} />
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <IconBell className="h-8 w-8 text-on-card-muted" />
                <p className="font-body text-sm font-medium text-on-card">No notifications yet</p>
                <p className="max-w-xs font-body text-xs text-on-card-muted">
                  Notices addressed to you — like personal-data disposal warnings — land here.
                </p>
              </div>
            ) : (
              <NotificationList
                entries={entries}
                audience="staff"
                tone="dark"
                timeZone={timeZone}
                pendingKey={markOne.isPending ? markOne.variables?.key : null}
                onMarkRead={(entry) => markOne.mutate(entry)}
                onNavigate={() => setOpen(false)}
              />
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
