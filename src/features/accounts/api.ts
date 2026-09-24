import { api, ApiError, normalizeList, type Paginated } from "@/api/client";
import { resourceKeys } from "@/api/query-keys";
import type { CurrentSession, StaffUser } from "@/features/accounts/types";

export const userKeys = resourceKeys("users");

/** GET-only, per ARCHITECTURE.md §2.2 (a feature's api.ts mirrors the
 * backend's selectors — reads, never writes). */
export async function getMe(): Promise<CurrentSession | null> {
  try {
    return await api.get<CurrentSession>("/api/v1/auth/me/");
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return null;
    }
    throw error;
  }
}

/** Staff users for assignee pickers and admin. May be paginated or a bare array. */
export function listUsers(params: { page?: number; pageSize?: number } = {}): Promise<
  Paginated<StaffUser> | StaffUser[]
> {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("page_size", String(params.pageSize));
  const qs = search.toString();
  const path = qs ? `/api/v1/auth/users/?${qs}` : "/api/v1/auth/users/";
  return api.get<Paginated<StaffUser> | StaffUser[]>(path);
}

export async function listUsersNormalized(
  params: { page?: number; pageSize?: number } = {},
): Promise<StaffUser[]> {
  return normalizeList(await listUsers(params));
}
