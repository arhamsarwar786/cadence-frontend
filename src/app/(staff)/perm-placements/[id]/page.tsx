"use client";

import { useQuery } from "@tanstack/react-query";
import { notFound, useParams } from "next/navigation";
import { PlacementActions } from "@/app/(staff)/perm-placements/page";
import { getPlacement, placementKeys } from "@/features/money/api";
import { isNotFound, messageFrom } from "@/shared/lib/errors";
import { formatMoney } from "@/shared/lib/money";
import { Chip, PageHeader, PageFrame, PageScrollRegion } from "@/shared/ui";

export default function PlacementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useQuery({
    queryKey: placementKeys.detail(id),
    queryFn: () => getPlacement(id),
    retry: false,
  });
  if (query.isError && isNotFound(query.error)) notFound();
  if (query.isLoading) return <p className="text-sm text-cadence-ink/60">Loading…</p>;
  if (query.isError) return <p className="text-sm text-cadence-red">{messageFrom(query.error)}</p>;
  const p = query.data;
  if (!p) return null;

  return (
    <PageFrame>
      <PageScrollRegion className="flex flex-col gap-6">
      <PageHeader
        title={p.employee_name}
        actions={
          <Chip tone={p.voided_at ? "danger" : "muted"}>{p.voided_at ? "voided" : p.status}</Chip>
        }
      />
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-cadence-ink/60">Client</dt>
          <dd>{p.client_name}</dd>
        </div>
        <div>
          <dt className="text-cadence-ink/60">Fee</dt>
          <dd>{"fee_amount" in p && p.fee_amount != null ? formatMoney(p.fee_amount) : "—"} ({p.fee_pct}%)</dd>
        </div>
        <div>
          <dt className="text-cadence-ink/60">Annual salary</dt>
          <dd>{formatMoney(p.annual_salary)}</dd>
        </div>
        <div>
          <dt className="text-cadence-ink/60">Confirmed</dt>
          <dd>{p.confirmed_at ?? "—"}</dd>
        </div>
      </dl>
      <PlacementActions id={id} />
    </PageScrollRegion>
    </PageFrame>
  );
}
