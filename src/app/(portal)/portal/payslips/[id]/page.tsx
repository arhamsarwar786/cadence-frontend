"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use } from "react";
import { PayslipStatusBadge } from "@/features/money/components/StatusBadges";
import { getPayslip } from "@/features/portal/api";
import { messageFrom } from "@/shared/lib/errors";
import { formatMoney } from "@/shared/lib/money";
import type { PayslipStatus } from "@/shared/lib/status-labels";
import { PortalCard, PortalFrame } from "../../../_components/PortalFrame";

export default function PortalPayslipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const query = useQuery({
    queryKey: ["portal", "payslips", id],
    queryFn: () => getPayslip(id),
  });
  const p = query.data;

  return (
    <PortalFrame title="Pay statement" subtitle="Your copy of an issued or paid statement.">
      <Link href="/portal/payslips" className="font-body text-sm text-cadence-ink/60 underline">
        Back to pay statements
      </Link>
      {query.isLoading ? (
        <p className="font-body text-sm text-cadence-ink/60">Loading…</p>
      ) : query.isError ? (
        <p className="font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>
      ) : p ? (
        <div className="flex flex-col gap-4">
          <PortalCard>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-heading text-2xl text-cadence-ink">{p.employee_name}</p>
                <p className="font-body text-sm text-cadence-ink/60">
                  Gross {formatMoney(p.gross)} · Net {formatMoney(p.net_amount)}
                </p>
              </div>
              <PayslipStatusBadge status={p.status as PayslipStatus} />
            </div>
            <a
              href={`/api/v1/portal/me/pay-statements/${p.id}/pdf/`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block font-body text-sm text-cadence-red underline"
            >
              Download PDF
            </a>
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
              {p.deduction_lines.map((line) => (
                <li key={line.id} className="flex justify-between">
                  <span>{line.label}</span>
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
