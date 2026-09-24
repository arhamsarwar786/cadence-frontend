import { api } from "@/api/client";
import type { CurrentUser } from "@/features/accounts/types";

/** `login` is email OR username (ARCHITECTURE.md §2.4) — one shared field,
 * resolved by Django's generated `login` column. */
export function login(credential: string, password: string): Promise<CurrentUser> {
  return api.post<CurrentUser>("/api/v1/auth/login/", { login: credential, password });
}

export function logout(): Promise<void> {
  return api.post<void>("/api/v1/auth/logout/");
}

/** Admin sets another user's password (staff or worker). Uses existing auth door. */
export function resetUserCredentials(userId: string, password: string): Promise<void> {
  return api.post<void>(`/api/v1/auth/users/${userId}/reset-credentials/`, { password });
}
