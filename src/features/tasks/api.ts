import { api, type Paginated } from "@/api/client";
import { resourceKeys } from "@/api/query-keys";
import type { Task } from "@/features/tasks/types";

export const taskKeys = resourceKeys("tasks");

export interface ListTasksParams {
  page?: number;
  pageSize?: number;
  status?: string;
  type?: string;
}

export function listTasks(params: ListTasksParams = {}): Promise<Paginated<Task>> {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("page_size", String(params.pageSize));
  if (params.status) search.set("status", params.status);
  if (params.type) search.set("type", params.type);
  const qs = search.toString();
  return api.get<Paginated<Task>>(`/api/v1/tasks/${qs ? `?${qs}` : ""}`);
}

export function getTask(id: string): Promise<Task> {
  return api.get<Task>(`/api/v1/tasks/${id}/`);
}
