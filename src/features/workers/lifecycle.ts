import type { LifecycleStatus } from "@/shared/lib/status-labels";

/** Matches API / model copy for work_status when lifecycle ≠ active. */
export const AVAILABILITY_ACTIVE_ONLY_MESSAGE =
  "Availability is only meaningful on an active employee.";

export function isActiveEmployee(
  lifecycle: LifecycleStatus | string | null | undefined,
): boolean {
  return lifecycle === "active";
}
