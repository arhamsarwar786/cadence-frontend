import { api } from "@/api/client";
import type { CurrentSession } from "@/features/accounts/types";

/** GET-only, per ARCHITECTURE.md §2.2 (a feature's api.ts mirrors the
 * backend's selectors — reads, never writes). */
export function getMe(): Promise<CurrentSession> {
  return api.get<CurrentSession>("/api/v1/auth/me/");
}
