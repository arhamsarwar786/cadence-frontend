import { api } from "@/api/client";
import type { NotificationTemplate, NotificationTemplateWrite } from "@/features/notifications/types";

export function listTemplates(): Promise<NotificationTemplate[]> {
  return api.get<NotificationTemplate[]>("/api/v1/notifications/templates/");
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
