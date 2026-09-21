import Link from "next/link";
import { EducationPanel } from "@/features/portal/components/SimplePanels";
import { PortalCard, PortalFrame } from "../../../_components/PortalFrame";

export default function PortalEducationPage() {
  return (
    <PortalFrame title="Education" subtitle="Add your education history.">
      <Link href="/portal/me" className="mb-4 inline-block text-sm underline">
        ← My profile
      </Link>
      <PortalCard>
        <EducationPanel />
      </PortalCard>
    </PortalFrame>
  );
}
