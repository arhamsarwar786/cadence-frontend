import { api, normalizeList, type Paginated } from "@/api/client";
import type {
  InboxNotification,
  NotificationTemplate,
  NotificationTemplateWrite,
  UnreadNotificationCount,
} from "@/features/notifications/types";

export async function listTemplates(): Promise<NotificationTemplate[]> {
  const data = await api.get<NotificationTemplate[] | Paginated<NotificationTemplate>>(
    "/api/v1/notifications/templates/",
  );
  return normalizeList(data);
}

export function createTemplate(body: NotificationTemplateWrite): Promise<NotificationTemplate> {
  return api.post<NotificationTemplate>("/api/v1/notifications/templates/", body);
}

export function updateTemplate(
  id: string,
  body: Partial<NotificationTemplateWrite>,
): Promise<NotificationTemplate> {
  return api.patch<NotificationTemplate>(`/api/v1/notifications/templates/${id}/`, body);
}

export function deleteTemplate(id: string): Promise<void> {
  return api.delete<void>(`/api/v1/notifications/templates/${id}/`);
}

// ── The signed-in account's own inbox ───────────────────────────────────────

/** Query keys for the inbox. Every write invalidates `notificationKeys.all`
 * so the bell's badge and any open list refresh together. */
export const notificationKeys = {
  all: ["notifications", "inbox"] as const,
  staffList: () => ["notifications", "inbox", "staff", "list"] as const,
  staffUnread: () => ["notifications", "inbox", "staff", "unread"] as const,
  portalList: () => ["notifications", "inbox", "portal", "list"] as const,
};

/** How often the bell re-asks (plus on window focus). Modest on purpose. */
export const NOTIFICATION_POLL_MS = 60_000;

/** The staff account's own delivered notifications, newest first (first page). */
export function listMyNotifications(): Promise<Paginated<InboxNotification>> {
  return api.get<Paginated<InboxNotification>>("/api/v1/notifications/me/?page_size=50");
}

export function getMyUnreadCount(): Promise<UnreadNotificationCount> {
  return api.get<UnreadNotificationCount>("/api/v1/notifications/me/unread-count/");
}

/** The worker's own notification rows (unpaginated, every state). */
export async function listPortalNotifications(): Promise<InboxNotification[]> {
  const data = await api.get<InboxNotification[] | Paginated<InboxNotification>>(
    "/api/v1/notifications/portal/me/notifications/",
  );
  return normalizeList(data);
}
