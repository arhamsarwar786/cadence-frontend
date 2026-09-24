import { api, normalizeList, type Paginated } from "@/api/client";
import type { NotificationTemplate, NotificationTemplateWrite } from "@/features/notifications/types";

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
