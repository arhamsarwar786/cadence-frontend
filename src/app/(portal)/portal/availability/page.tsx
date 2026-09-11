import { AvailabilityPanel, TimeOffPanel } from "@/features/portal/components/SimplePanels";

export default function PortalAvailabilityPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-heading text-3xl text-cadence-ink">Availability</h1>
      <AvailabilityPanel />
      <TimeOffPanel />
    </div>
  );
}
