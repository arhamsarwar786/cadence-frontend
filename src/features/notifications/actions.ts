import { api } from "@/api/client";
import type { MarkReadResult } from "@/features/notifications/types";

/** Inbox writes (ARCHITECTURE.md §2.2 — api.ts reads, actions.ts writes).
 * One read door per side: name the ids, or omit them to mark every unread
 * row read. Idempotent — the answer is how many rows moved. */

export function markMyNotificationsRead(ids?: string[]): Promise<MarkReadResult> {
  return api.post<MarkReadResult>("/api/v1/notifications/me/read/", ids ? { ids } : {});
}

export function markPortalNotificationsRead(ids?: string[]): Promise<MarkReadResult> {
  return api.post<MarkReadResult>(
    "/api/v1/notifications/portal/me/notifications/read/",
    ids ? { ids } : {},
  );
}
