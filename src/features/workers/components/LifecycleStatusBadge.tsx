import type { BadgeTone } from "@/shared/ui";
import { Badge } from "@/shared/ui";
import { LIFECYCLE_STATUS_LABELS, type LifecycleStatus } from "@/shared/lib/status-labels";

const TONE: Record<LifecycleStatus, BadgeTone> = {
  applicant: "neutral",
  onboarding: "info",
  active: "positive",
  out: "warning",
};

export function LifecycleStatusBadge({ status }: { status: LifecycleStatus }) {
  return <Badge tone={TONE[status]}>{LIFECYCLE_STATUS_LABELS[status]}</Badge>;
}
