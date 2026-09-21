"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { approvePayrollRun, releasePayrollRun } from "@/features/money/actions";
import { exportPayrollRunUrl, getPayrollRun, payrollRunKeys } from "@/features/money/api";
import {
  PayStatementStatusBadge,
  PayrollRunStatusBadge,
} from "@/features/money/components/StatusBadges";
import { listWorkers, getWorker } from "@/features/workers/api";
import type { PayStatement } from "@/features/money/types";
import { isNotFound, messageFrom } from "@/shared/lib/errors";
import { formatMoney } from "@/shared/lib/money";
import type { PayStatementStatus, PayrollRunStatus } from "@/shared/lib/status-labels";
import { PERM } from "@/permissions/keys";
import { Avatar, Button, ListLayout, PermGate, SearchField, Table, type Column } from "@/shared/ui";

export default function PayrollRunDetailPage() {
  const { id: runId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [q, setQ] = useState("");

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

  const statements = query.data?.pay_statements ?? [];
  const workersLookup = useQuery({
    queryKey: ["workers-pay-method-map"],
    queryFn: () => listWorkers({ pageSize: 200 }),
    enabled: statements.length > 0,
  });
  const payMethodByEmployee = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of workersLookup.data?.results ?? []) {
      if (w.pay_method) map.set(w.id, w.pay_method);
    }
    return map;
  }, [workersLookup.data?.results]);

  const filtered = useMemo(() => {
    if (!q.trim()) return statements;
    const needle = q.toLowerCase();
    return statements.filter((p) => p.employee_name.toLowerCase().includes(needle));
  }, [q, statements]);

  const paid = statements.filter((p) => p.status === "paid").length;
  const pending = statements.filter((p) => p.status !== "paid").length;

  const columns: Column<PayStatement>[] = [
    {
      header: "Name",
      cell: (p) => (
        <span className="flex items-center gap-2">
          <Avatar name={p.employee_name} size="sm" />
          {p.employee_name}
        </span>
      ),
    },
    {
      header: "Preference",
      cell: (p) =>
        (payMethodByEmployee.get(p.employee_id) ?? "—").replaceAll("_", " "),
    },
    {
      header: "Amount",
      cell: (p) => ("gross" in p ? formatMoney(p.gross) : "—"),
    },
    {
      header: "Status",
      cell: (p) => <PayStatementStatusBadge status={p.status as PayStatementStatus} />,
    },
    {
      header: "Hours",
      cell: (p) => ("hours_total" in p && p.hours_total != null ? `${p.hours_total}h` : "—"),
    },
  ];

  if (query.isLoading) return <p className="font-body text-sm text-cadence-ink/60">Loading…</p>;
  if (query.isError) {
    return <p className="font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>;
  }
  const run = query.data;
  if (!run) return null;
  const status = run.status as PayrollRunStatus;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl text-cadence-ink">
            {run.period_start} – {run.period_end}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <PayrollRunStatusBadge status={status} paidAt={run.paid_at} />
            <span className="font-body text-sm text-cadence-ink/60">Payday {run.payday}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {status === "draft" ? (
            <PermGate anyOf={PERM.PAYROLL_APPROVE}>
              <Button onClick={() => runAction(() => approvePayrollRun(runId))}>Approve</Button>
            </PermGate>
          ) : null}
          {status === "approved" && !run.paid_at ? (
            <PermGate anyOf={PERM.PAYROLL_RELEASE}>
              <Button onClick={() => runAction(() => releasePayrollRun(runId))}>
                Release pay statements
              </Button>
            </PermGate>
          ) : null}
          <PermGate anyOf={PERM.PAYROLL_EXPORT}>
            <a href={exportPayrollRunUrl(runId)} download>
              <Button variant="secondary">Export CSV</Button>
            </a>
          </PermGate>
        </div>
      </div>

      {actionError ? <p className="font-body text-sm text-cadence-red">{actionError}</p> : null}

      <SearchField value={q} onChange={setQ} placeholder="Find by name" label="Find payees" />

      <ListLayout
        stats={[
          { value: paid, label: "paid", tone: "lime" },
          { value: pending, label: "pending", tone: "orange" },
          { value: run.payday, label: "payday", tone: "ink" },
          { value: statements.length, label: "total payees", tone: "ink" },
        ]}
      >
        <Table
          columns={columns}
          rows={filtered}
          rowKey={(p) => p.id}
          emptyMessage="No pay statements yet."
          onRowClick={(p) => {
            window.location.href = `/payroll/pay-statements/${p.id}`;
          }}
        />
      </ListLayout>

      <p className="font-body text-xs text-cadence-ink/50">
        Prefer deep links:{" "}
        {statements.slice(0, 3).map((p) => (
          <Link key={p.id} href={`/payroll/pay-statements/${p.id}`} className="mr-2 underline">
            {p.employee_name}
          </Link>
        ))}
      </p>
    </div>
  );
}
