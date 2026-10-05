"use client";

import { Loading } from "@/shared/ui/Loading";
import { QueryError } from "@/shared/ui/QueryError";
import { useQuery } from "@tanstack/react-query";
import { use } from "react";
import { PayStatementStatusBadge } from "@/features/money/components/StatusBadges";
import { getPayslip } from "@/features/portal/api";
import { formatMoney } from "@/shared/lib/money";
import type { PayStatementStatus } from "@/shared/lib/status-labels";
import { PortalCard, PortalFrame } from "../../../_components/PortalFrame";

export default function PortalPayStatementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const query = useQuery({
    queryKey: ["portal", "pay-statements", id],
    queryFn: () => getPayslip(id),
  });
  const p = query.data;

  return (
    <PortalFrame title="Pay statement" subtitle="Your copy of an issued or paid statement.">
      <p className="rounded-2xl bg-cadence-yellow/40 px-4 py-3 font-body text-sm text-cadence-ink">
        This is a pay statement, not your official pay record. Signing confirms you have received and
        reviewed this pay statement.
      </p>
      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => query.refetch()} />
      ) : p ? (
        <div className="mt-4 flex flex-col gap-4">
          <PortalCard>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-heading text-2xl text-cadence-ink">{p.employee_name}</p>
                <p className="font-body text-sm text-cadence-ink/60">
                  Gross {formatMoney(p.gross)} · Net {formatMoney(p.net_amount)}
                </p>
              </div>
              <PayStatementStatusBadge status={p.status as PayStatementStatus} />
            </div>
            {p.document_id ? (
              <a
                href={`/api/v1/portal/me/pay-statements/${p.id}/pdf/`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block font-body text-sm text-cadence-red underline"
              >
                Download PDF
              </a>
            ) : (
              <p className="mt-4 font-body text-sm text-cadence-ink/60">
                A PDF copy isn&apos;t available for this statement yet — the office hasn&apos;t
                generated one. The details below are your full statement.
              </p>
            )}
          </PortalCard>
          <PortalCard>
            <h2 className="mb-3 font-subheading text-sm uppercase tracking-[0.14em] text-cadence-ink/50">
              Earnings
            </h2>
            <ul className="flex flex-col gap-2 font-body text-sm">
              {p.lines.map((line) => (
                <li key={line.id} className="flex justify-between">
                  <span>{line.description ?? line.type}</span>
                  <span>{formatMoney(line.amount)}</span>
                </li>
              ))}
            </ul>
          </PortalCard>
          <PortalCard>
            <h2 className="mb-3 font-subheading text-sm uppercase tracking-[0.14em] text-cadence-ink/50">
              Deductions
            </h2>
            <ul className="flex flex-col gap-2 font-body text-sm">
              {(p.deduction_lines ?? []).map((line) => (
                <li key={line.id} className="flex justify-between">
                  <span>
                    {"label" in line && line.label
                      ? String(line.label)
                      : "code" in line
                        ? String(line.code)
                        : "Deduction"}
                  </span>
                  <span>{formatMoney(line.amount)}</span>
                </li>
              ))}
            </ul>
          </PortalCard>
        </div>
      ) : null}
    </PortalFrame>
  );
}
