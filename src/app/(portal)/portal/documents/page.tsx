import { DocumentsPanel } from "@/features/portal/components/DocumentsPanel";
import { PortalCard, PortalFrame } from "../../_components/PortalFrame";

export default function PortalDocumentsPage() {
  return (
    <PortalFrame
      title="Documents"
      subtitle="Intake files you upload yourself: résumé, IDs, permits. Office-verified files cannot be removed here."
    >
      <PortalCard>
        <DocumentsPanel />
      </PortalCard>
    </PortalFrame>
  );
}
