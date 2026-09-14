import { AvailabilityPanel, TimeOffPanel } from "@/features/portal/components/SimplePanels";
import { PortalCard, PortalFrame } from "../../_components/PortalFrame";

export default function PortalAvailabilityPage() {
  return (
    <PortalFrame
      title="Availability"
      subtitle="Weekly windows the office uses when placing you, plus time-off you need blocked."
    >
      <PortalCard>
        <AvailabilityPanel />
      </PortalCard>
      <PortalCard>
        <TimeOffPanel />
      </PortalCard>
    </PortalFrame>
  );
}
