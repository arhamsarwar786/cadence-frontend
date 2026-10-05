"use client";

import Link from "next/link";
import { describeNotification, type InboxEntry } from "@/features/notifications/describe";
import { cn } from "@/shared/lib/cn";
import { formatDateTime } from "@/shared/lib/datetime";
import { Button } from "@/shared/ui";

/**
 * The inbox rows, shared by the staff bell panel (charcoal card) and the
 * portal page (cream card). Unread rows carry a yellow dot and a Mark read
 * button; every row says what happened, when, and where to act on it.
 */
export function NotificationList({
  entries,
  audience,
  timeZone,
  onMarkRead,
  pendingKey,
  onNavigate,
  tone = "light",
}: {
  entries: InboxEntry[];
  audience: "staff" | "portal";
  timeZone?: string;
  onMarkRead: (entry: InboxEntry) => void;
  /** The entry whose mark-read is in flight. */
  pendingKey?: string | null;
  /** Called when the user follows a row's link (the panel closes). */
  onNavigate?: () => void;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <ul className="flex flex-col gap-2" aria-label="Notifications">
      {entries.map((entry) => {
        const { row, unread } = entry;
        const summary = describeNotification(row, audience);
        const when = row.sent_at ?? row.created_at;
        const pending = pendingKey === entry.key;
        return (
          <li
            key={entry.key}
            className={cn(
              "flex items-start gap-3 rounded-2xl px-4 py-3",
              dark
                ? unread
                  ? "bg-white/[0.07]"
                  : "bg-transparent"
                : unread
                  ? "bg-surface shadow-card"
                  : "bg-surface/50",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                unread ? "bg-cadence-yellow" : dark ? "bg-white/15" : "bg-cadence-ink/15",
              )}
            />
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "font-body text-sm",
                  unread ? "font-semibold" : "font-medium",
                  dark ? "text-on-card" : "text-cadence-ink",
                )}
              >
                {summary.title}
                {unread ? <span className="sr-only"> (unread)</span> : null}
              </p>
              <p
                className={cn(
                  "mt-0.5 break-words font-body text-sm",
                  dark ? "text-on-card-muted" : "text-cadence-ink/70",
                )}
              >
                {summary.body}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <time
                  dateTime={when}
                  className={cn(
                    "font-fine text-[11px]",
                    dark ? "text-on-card-muted" : "text-cadence-ink/55",
                  )}
                >
                  {formatDateTime(when, zone)}
                </time>
                {!unread && (row.status === "queued" || row.status === "pending_approval") ? (
                  <span
                    className={cn(
                      "font-fine text-[11px]",
                      dark ? "text-on-card-muted" : "text-cadence-ink/55",
                    )}
                  >
                    · On its way
                  </span>
                ) : null}
                {summary.href ? (
                  <Link
                    href={summary.href}
                    onClick={onNavigate}
                    className={cn(
                      "font-body text-xs underline underline-offset-2",
                      dark ? "text-cadence-yellow" : "text-cadence-ink",
                    )}
                  >
                    {summary.hrefLabel ?? "Open"}
                  </Link>
                ) : null}
              </div>
            </div>
            {unread ? (
              <Button
                variant={dark ? "ghost" : "secondary"}
                size="sm"
                className="shrink-0"
                disabled={pending}
                onClick={() => onMarkRead(entry)}
                aria-label={`Mark "${summary.title}" as read`}
              >
                {pending ? "Saving…" : "Mark read"}
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
