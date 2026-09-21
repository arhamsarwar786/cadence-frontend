"use client";

import { useSession } from "@/auth/session-context";

/**
 * Agency clock from GET /api/v1/auth/me/ → organization.timezone.
 * Every schedule-facing formatDate* call must use this — never UTC or the browser.
 */
export function useOrgTimeZone(): string | undefined {
  return useSession().session?.organization.timezone;
}
