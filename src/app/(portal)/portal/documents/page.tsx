import { DocumentsPanel } from "@/features/portal/components/DocumentsPanel";

export default function PortalDocumentsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-3xl text-cadence-ink">Documents</h1>
      <DocumentsPanel />
    </div>
  );
}
