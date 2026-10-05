import { CertsPanel } from "@/features/portal/components/CertsPanel";
import { PortalCard, PortalFrame } from "../../../_components/PortalFrame";

export default function PortalCertsPage() {
  return (
    <PortalFrame
      title="Certifications & licenses"
      subtitle="Unverified entries can be edited anytime. Verified ones are locked."
    >
      <PortalCard>
        <CertsPanel />
      </PortalCard>
    </PortalFrame>
  );
}
