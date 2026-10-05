import { TimeOffPanel } from "@/features/portal/components/SimplePanels";
import { PortalCard, PortalFrame } from "../../../_components/PortalFrame";

export default function PortalTimeOffPage() {
  return (
    <PortalFrame title="Time off" subtitle="Request time away from work.">
      <PortalCard>
        <TimeOffPanel />
      </PortalCard>
    </PortalFrame>
  );
}
