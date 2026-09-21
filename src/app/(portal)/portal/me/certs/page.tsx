import Link from "next/link";
import { CertsPanel } from "@/features/portal/components/CertsPanel";
import { PortalCard, PortalFrame } from "../../../_components/PortalFrame";

export default function PortalCertsPage() {
  return (
    <PortalFrame
      title="Certifications & licenses"
      subtitle="Unverified entries can be edited anytime. Verified ones are locked."
    >
      <Link href="/portal/me" className="mb-4 inline-block text-sm underline">
        ← My profile
      </Link>
      <PortalCard>
        <CertsPanel />
      </PortalCard>
    </PortalFrame>
  );
}
