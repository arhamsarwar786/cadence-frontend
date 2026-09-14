import type { BadgeTone } from "@/shared/ui";
import { Badge } from "@/shared/ui";
import { CLIENT_STATUS_LABELS, type ClientStatus } from "@/shared/lib/status-labels";

const TONE: Record<ClientStatus, BadgeTone> = {
  prospect: "info",
  active: "positive",
  inactive: "neutral",
};

/** Renders the closed enum only — never computes the next status
 * (ARCHITECTURE.md §8 folder rules). */
export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return (
    <Badge tone={TONE[status]} tooltip={`Client: ${CLIENT_STATUS_LABELS[status]}`}>
      {CLIENT_STATUS_LABELS[status]}
    </Badge>
  );
}
