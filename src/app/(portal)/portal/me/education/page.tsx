import { EducationPanel } from "@/features/portal/components/SimplePanels";
import { PortalCard, PortalFrame } from "../../../_components/PortalFrame";

export default function PortalEducationPage() {
  return (
    <PortalFrame title="Education" subtitle="Add your education history.">
      <PortalCard>
        <EducationPanel />
      </PortalCard>
    </PortalFrame>
  );
}
