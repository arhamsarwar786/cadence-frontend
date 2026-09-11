import type { Employee } from "@/features/workers/types";
import { CONSENT_SOURCE_LABELS, type ConsentSource } from "@/shared/lib/status-labels";

/** Read-only for staff — consent capture is a worker-portal act only
 * (ARCHITECTURE.md §3: "Consent capture" lives under Portal, not staff). */
export function ConsentPanel({ worker }: { worker: Employee }) {
  const consent = worker.consent;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-subheading text-xl text-cadence-ink">Consent</h2>
      {consent ? (
        <dl className="grid max-w-xl grid-cols-2 gap-x-8 gap-y-2 font-body text-sm">
          <div>
            <dt className="text-cadence-ink/60">Version</dt>
            <dd className="text-cadence-ink">{consent.version}</dd>
          </div>
          <div>
            <dt className="text-cadence-ink/60">Source</dt>
            <dd className="text-cadence-ink">{CONSENT_SOURCE_LABELS[consent.source as ConsentSource]}</dd>
          </div>
          <div>
            <dt className="text-cadence-ink/60">Captured</dt>
            <dd className="text-cadence-ink">{new Date(consent.created_at).toLocaleString()}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-cadence-ink/60">Text agreed to</dt>
            <dd className="whitespace-pre-wrap text-cadence-ink">{consent.text}</dd>
          </div>
        </dl>
      ) : (
        <p className="font-body text-sm text-cadence-ink/60">
          This worker has not consented yet.
        </p>
      )}
    </section>
  );
}
