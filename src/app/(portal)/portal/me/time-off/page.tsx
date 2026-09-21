import Link from "next/link";
import { TimeOffPanel } from "@/features/portal/components/SimplePanels";
import { PortalCard, PortalFrame } from "../../../_components/PortalFrame";

export default function PortalTimeOffPage() {
  return (
    <PortalFrame title="Time off" subtitle="Request time away from work.">
      <Link href="/portal/me" className="mb-4 inline-block text-sm underline">
        ← My profile
      </Link>
      <PortalCard>
        <TimeOffPanel />
      </PortalCard>
    </PortalFrame>
  );
}
