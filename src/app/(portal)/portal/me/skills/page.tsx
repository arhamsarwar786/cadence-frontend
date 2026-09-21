import Link from "next/link";
import { SkillsPanel } from "@/features/portal/components/SimplePanels";
import { PortalCard, PortalFrame } from "../../../_components/PortalFrame";

export default function PortalSkillsPage() {
  return (
    <PortalFrame title="Skills & experience" subtitle="Recruiters match you to jobs using this.">
      <Link href="/portal/me" className="mb-4 inline-block text-sm underline">
        ← My profile
      </Link>
      <PortalCard>
        <SkillsPanel />
      </PortalCard>
    </PortalFrame>
  );
}
