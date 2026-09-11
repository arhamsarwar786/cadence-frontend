import { api } from "@/api/client";
import type { Task, TaskAssign, TaskWrite } from "@/features/tasks/types";

export function createTask(body: TaskWrite): Promise<Task> {
  return api.post<Task>("/api/v1/tasks/", body);
}

export function updateTask(id: string, body: Partial<TaskWrite>): Promise<Task> {
  return api.patch<Task>(`/api/v1/tasks/${id}/`, body);
}

export function deleteTask(id: string): Promise<void> {
  return api.delete<void>(`/api/v1/tasks/${id}/`);
}

export function assignTask(id: string, body: TaskAssign): Promise<Task> {
  return api.post<Task>(`/api/v1/tasks/${id}/assign/`, body);
}

/** Refused for the two state-mirrored types (invoice_approval,
 * privacy_request) — the linked act is what closes those, never a manual
 * complete (ARCHITECTURE.md §5.1). The server re-checks regardless of
 * what the UI shows. */
export function completeTask(id: string): Promise<Task> {
  return api.post<Task>(`/api/v1/tasks/${id}/complete/`);
}

export function reopenTask(id: string): Promise<Task> {
  return api.post<Task>(`/api/v1/tasks/${id}/reopen/`);
}
