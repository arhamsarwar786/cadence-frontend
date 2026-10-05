import type { components } from "@openapi/schema";

export type NotificationTemplate = components["schemas"]["NotificationTemplate"];
export type NotificationTemplateWrite = components["schemas"]["NotificationTemplateWrite"];

/** One of the signed-in account's own notification rows (the portal list
 * and the staff inbox share the shape). `sent` = delivered and unread,
 * `read` = acknowledged; queued / pending_approval have told nobody yet. */
export type InboxNotification = components["schemas"]["PortalNotification"];
export type InboxNotificationType = InboxNotification["type"];

export interface UnreadNotificationCount {
  unread: number;
}

export interface MarkReadResult {
  updated: number;
}
