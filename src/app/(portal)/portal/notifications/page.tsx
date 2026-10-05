"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useOrgTimeZone } from "@/auth/use-org-timezone";
import { markPortalNotificationsRead } from "@/features/notifications/actions";
import { listPortalNotifications, notificationKeys } from "@/features/notifications/api";
import { NotificationList } from "@/features/notifications/components/NotificationList";
import { collapseInbox, type InboxEntry } from "@/features/notifications/describe";
import { messageFrom } from "@/shared/lib/errors";
import { Button, EmptyState, ListSkeleton, QueryError, useToast } from "@/shared/ui";
import { PortalCard, PortalFrame } from "../../_components/PortalFrame";

export default function PortalNotificationsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const timeZone = useOrgTimeZone();
  const query = useQuery({
    queryKey: notificationKeys.portalList(),
    queryFn: listPortalNotifications,
    refetchOnWindowFocus: true,
  });
  const entries = useMemo(() => collapseInbox(query.data ?? []), [query.data]);
  const unread = entries.filter((entry) => entry.unread).length;

  const markOne = useMutation({
    mutationFn: (entry: InboxEntry) => markPortalNotificationsRead(entry.unreadIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
    onError: (error) => toast.error(messageFrom(error)),
  });
  const markAll = useMutation({
    mutationFn: () => markPortalNotificationsRead(),
    onSuccess: () => {
      toast.success("All notifications marked read");
      return queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
    onError: (error) => toast.error(messageFrom(error)),
  });

  return (
    <PortalFrame title="Notifications" subtitle="Messages your agency sent you — signature requests, shift offers and more.">
      {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => query.refetch()} />
      ) : entries.length === 0 ? (
        <PortalCard>
          <EmptyState
            title="No notifications yet"
            description="When your agency sends you something to sign or a shift to accept, it shows up here."
          />
        </PortalCard>
      ) : (
        <section aria-labelledby="notifications-summary" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p id="notifications-summary" className="font-body text-sm text-cadence-ink/70" aria-live="polite">
              {unread > 0 ? `${unread} unread` : "You're all caught up."}
            </p>
            {unread > 0 ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
              >
                {markAll.isPending ? "Marking…" : "Mark all read"}
              </Button>
            ) : null}
          </div>
          <NotificationList
            entries={entries}
            audience="portal"
            timeZone={timeZone}
            pendingKey={markOne.isPending ? markOne.variables?.key : null}
            onMarkRead={(entry) => markOne.mutate(entry)}
          />
        </section>
      )}
    </PortalFrame>
  );
}
