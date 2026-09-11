"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notFound, useParams } from "next/navigation";
import { useState } from "react";
import { approvePayrollRun, releasePayrollRun } from "@/features/money/actions";
import { getPayrollRun, payrollRunKeys } from "@/features/money/api";
import { PayrollRunStatusBadge, PayslipStatusBadge } from "@/features/money/components/StatusBadges";
import type { Payslip } from "@/features/money/types";
import { isNotFound, messageFrom } from "@/shared/lib/errors";
import { formatMoney } from "@/shared/lib/money";
import type { PayrollRunStatus, PayslipStatus } from "@/shared/lib/status-labels";
import { Button } from "@/shared/ui";

export default function PayrollRunDetailPage() {
  const { id: runId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: payrollRunKeys.detail(runId),
    queryFn: () => getPayrollRun(runId),
    retry: false,
  });

  if (query.isError && isNotFound(query.error)) notFound();

  function refetch() {
    return queryClient.invalidateQueries({ queryKey: payrollRunKeys.detail(runId) });
  }

  async function runAction(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
      await refetch();
    } catch (error) {
      setActionError(messageFrom(error));
    }
  }

  if (query.isLoading) return <p className="font-body text-sm text-cadence-ink/60">Loading…</p>;
  if (query.isError) {
    return <p className="font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>;
  }
  const run = query.data;
  if (!run) return null;
  const status = run.status as PayrollRunStatus;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-3xl text-cadence-ink">
            {run.period_start} – {run.period_end}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <PayrollRunStatusBadge status={status} />
            <span className="font-body text-sm text-cadence-ink/60">Payday {run.payday}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {status === "draft" ? (
            <Button onClick={() => runAction(() => approvePayrollRun(runId))}>Approve</Button>
          ) : !run.paid_at ? (
            <Button onClick={() => runAction(() => releasePayrollRun(runId))}>
              Release (mark paid)
            </Button>
          ) : null}
        </div>
      </div>

      {actionError ? <p className="font-body text-sm text-cadence-red">{actionError}</p> : null}

      <section className="flex flex-col gap-3">
        <h2 className="font-subheading text-xl text-cadence-ink">Pay statements</h2>
        {run.payslips.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {run.payslips.map((p: Payslip) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-body text-sm font-medium text-cadence-ink">
                    {p.employee_name}
                  </p>
                  <p className="font-body text-xs text-cadence-ink/60">
                    {"gross" in p ? `Gross ${formatMoney(p.gross)}` : ""}
                    {"net_amount" in p ? ` · Net ${formatMoney(p.net_amount)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <PayslipStatusBadge status={p.status as PayslipStatus} />
                  <a
                    href={`/api/v1/payroll/payslips/${p.id}/pdf/`}
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
          <p className="font-body text-sm text-cadence-ink/60">No pay statements yet.</p>
        )}
      </section>
    </div>
  );
}
