import { api, ApiError } from "@/api/client";
import type { CurrentSession } from "@/features/accounts/types";

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
