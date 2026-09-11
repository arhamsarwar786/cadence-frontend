"use client";

import { useQuery } from "@tanstack/react-query";
import { PayslipStatusBadge } from "@/features/money/components/StatusBadges";
import { listPayslips } from "@/features/portal/api";
import { messageFrom } from "@/shared/lib/errors";
import { formatMoney } from "@/shared/lib/money";
import type { PayslipStatus } from "@/shared/lib/status-labels";

export default function PortalPayslipsPage() {
  const query = useQuery({ queryKey: ["portal", "payslips"], queryFn: listPayslips });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-3xl text-cadence-ink">Pay statements</h1>
      {query.isLoading ? (
        <p className="font-body text-sm text-cadence-ink/60">Loading…</p>
      ) : query.isError ? (
        <p className="font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>
      ) : query.data && query.data.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {query.data.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-body text-sm font-medium text-cadence-ink">
                  {"gross" in p ? `Gross ${formatMoney(p.gross)}` : ""}
                  {"net_amount" in p ? ` · Net ${formatMoney(p.net_amount)}` : ""}
                </p>
                <p className="font-body text-xs text-cadence-ink/60">
                  {"hours_total" in p ? `${p.hours_total ?? "—"} hours` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <PayslipStatusBadge status={p.status as PayslipStatus} />
                <a
                  href={`/api/v1/portal/me/payslips/${p.id}/pdf/`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-body text-sm text-cadence-red underline"
                >
                  PDF
                </a>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-sm text-cadence-ink/60">
          No pay statements yet — issued and paid statements appear here.
        </p>
      )}
    </div>
  );
}
