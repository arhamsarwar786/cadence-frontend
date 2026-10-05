import { SkillsPanel } from "@/features/portal/components/SimplePanels";
import { PortalCard, PortalFrame } from "../../../_components/PortalFrame";

export default function PortalSkillsPage() {
  return (
    <PortalFrame title="Skills & experience" subtitle="Recruiters match you to jobs using this.">
      <PortalCard>
        <SkillsPanel />
      </PortalCard>
    </PortalFrame>
  );
}
