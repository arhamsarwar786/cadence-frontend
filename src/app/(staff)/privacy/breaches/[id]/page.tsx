"use client";

import { useQuery } from "@tanstack/react-query";
import { notFound, useParams } from "next/navigation";
import { api } from "@/api/client";
import { resourceKeys } from "@/api/query-keys";
import { isNotFound, messageFrom } from "@/shared/lib/errors";
import { Chip, PageHeader, PageFrame, PageScrollRegion } from "@/shared/ui";

const breachKeys = resourceKeys("privacy-breaches");

interface PrivacyBreach {
  id: string;
  discovered_on: string;
  occurred_on: string | null;
  description: string;
  personal_information: string;
  rrosh: string;
  individuals_notified: boolean;
  reported_to_commissioner: boolean;
  retention_until: string;
  created_at: string;
}

export default function BreachDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useQuery({
    queryKey: breachKeys.detail(id),
    queryFn: () => api.get<PrivacyBreach>(`/api/v1/privacy/breaches/${id}/`),
    retry: false,
  });
  if (query.isError && isNotFound(query.error)) notFound();
  if (query.isLoading) return <p className="text-sm text-cadence-ink/60">Loading…</p>;
  if (query.isError) return <p className="text-sm text-cadence-red">{messageFrom(query.error)}</p>;
  const b = query.data;
  if (!b) return null;

  return (
    <PageFrame>
      <PageScrollRegion className="flex flex-col gap-6">
      <PageHeader
        title="Breach record"
        actions={
          <Chip tone={b.rrosh === "real_risk" ? "danger" : "muted"}>
            {b.rrosh === "real_risk" ? "Real risk" : "No real risk"}
          </Chip>
        }
      />
      <p className="text-sm text-cadence-ink/55">Write-once — no edit.</p>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-cadence-ink/60">Discovered</dt>
          <dd>{b.discovered_on}</dd>
        </div>
        <div>
          <dt className="text-cadence-ink/60">Occurred</dt>
          <dd>{b.occurred_on ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-cadence-ink/60">Description</dt>
          <dd className="whitespace-pre-wrap">{b.description}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-cadence-ink/60">Personal information</dt>
          <dd className="whitespace-pre-wrap">{b.personal_information}</dd>
        </div>
        <div>
          <dt className="text-cadence-ink/60">Individuals notified</dt>
          <dd>{b.individuals_notified ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt className="text-cadence-ink/60">Reported to commissioner</dt>
          <dd>{b.reported_to_commissioner ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt className="text-cadence-ink/60">Retain until</dt>
          <dd>{b.retention_until}</dd>
        </div>
      </dl>
    </PageScrollRegion>
    </PageFrame>
  );
}
