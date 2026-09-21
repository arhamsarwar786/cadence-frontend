"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { createPayrollRun, generatePayrollRun } from "@/features/money/actions";
import { listPayCycles, listPayrollRuns, payCycleKeys, payrollRunKeys } from "@/features/money/api";
import { PayrollRunStatusBadge } from "@/features/money/components/StatusBadges";
import { payrollRunCreateSchema, type PayrollRunCreateFormValues } from "@/features/money/schemas";
import type { PayCycle, PayrollRun } from "@/features/money/types";
import { useOrgTimeZone } from "@/auth/use-org-timezone";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import type { PayrollRunStatus } from "@/shared/lib/status-labels";
import { PERM } from "@/permissions/keys";
import { Button, Dialog, Field, Input, ListLayout, ListSkeleton, PageHeader, Pagination, PermGate, Table, type Column } from "@/shared/ui";

const PAGE_SIZE = 50;
const FIELD_NAMES = Object.keys(payrollRunCreateSchema.shape);

function NewRunForm({ onDone }: { onDone: (id: string) => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PayrollRunCreateFormValues>({ resolver: zodResolver(payrollRunCreateSchema) });

  async function submit(values: PayrollRunCreateFormValues) {
    setFormError(null);
    try {
      const run = await createPayrollRun(values);
      onDone(run.id);
    } catch (error) {
      const matched = applyFieldErrors(setError, error, FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Period start" htmlFor="run-start" error={errors.period_start?.message}>
          <Input id="run-start" type="date" {...register("period_start")} />
        </Field>
        <Field label="Period end" htmlFor="run-end" error={errors.period_end?.message}>
          <Input id="run-end" type="date" {...register("period_end")} />
        </Field>
      </div>
      <Field label="Payday" htmlFor="run-payday" error={errors.payday?.message}>
        <Input id="run-payday" type="date" {...register("payday")} />
      </Field>
      {formError ? <p className="font-body text-sm text-cadence-red">{formError}</p> : null}
      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? "Creating…" : "Create run"}
      </Button>
    </form>
  );
}

export default function PayrollRunsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const timeZone = useOrgTimeZone();
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const [newOpen, setNewOpen] = useState(false);

  const query = useQuery({
    queryKey: payrollRunKeys.list({ page }),
    queryFn: () => listPayrollRuns({ page, pageSize: PAGE_SIZE }),
  });
  const cyclesQuery = useQuery({
    queryKey: payCycleKeys.list(),
    queryFn: async () => {
      const data = await listPayCycles();
      return Array.isArray(data) ? data : data.results;
    },
  });
  const [genError, setGenError] = useState<string | null>(null);
  function goToPage(nextPage: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(nextPage));
    router.push(`/payroll?${params.toString()}`);
  }

  const columns: Column<PayrollRun>[] = [
    { header: "Period", cell: (r) => `${r.period_start} – ${r.period_end}` },
    { header: "Payday", cell: (r) => r.payday },
    {
      header: "Status",
      cell: (r) => <PayrollRunStatusBadge status={r.status as PayrollRunStatus} paidAt={r.paid_at} />,
    },
    { header: "Paid", cell: (r) => (r.paid_at ? "Yes" : "No") },
  ];

  const cycles = (cyclesQuery.data ?? []) as PayCycle[];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Pay statements"
        actions={
          <div className="flex flex-wrap gap-2">
            <PermGate anyOf={PERM.PAYROLL_RUN}>
              <Button
                variant="secondary"
                onClick={async () => {
                  setGenError(null);
                  try {
                    const run = await generatePayrollRun();
                    await queryClient.invalidateQueries({ queryKey: payrollRunKeys.all });
                    router.push(`/payroll/runs/${run.id}`);
                  } catch (error) {
                    setGenError(messageFrom(error));
                  }
                }}
              >
                Generate next run
              </Button>
            </PermGate>
            <PermGate anyOf={PERM.PAYROLL_RUN}>
              <Button onClick={() => setNewOpen(true)}>New run</Button>
            </PermGate>
          </div>
        }
      />
      {genError ? <p className="font-body text-sm text-cadence-red">{genError}</p> : null}

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-2 font-subheading text-sm uppercase tracking-wide text-cadence-ink/50">
          Pay cycles
        </h2>
        {cyclesQuery.isLoading ? (
          <p className="text-sm text-cadence-ink/50">Loading…</p>
        ) : cycles.length === 0 ? (
          <p className="text-sm text-cadence-ink/50">No pay cycles configured yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {cycles.map((c) => (
              <li key={c.id} className="flex justify-between gap-3">
                <span>
                  {c.name} · {c.period_kind}
                  {c.active ? " · active" : ""}
                </span>
                <span className="text-cadence-ink/50">
                  anchor {c.anchor_date} · payday +{c.payday_offset_days}d
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError ? (
        <p className="font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>
      ) : (
        <ListLayout
          stats={[
            { value: query.data?.count ?? 0, label: "runs", tone: "ink" },
            {
              value: timeZone
                ? new Intl.DateTimeFormat("en-CA", {
                    month: "short",
                    day: "numeric",
                    timeZone,
                  }).format(new Date())
                : "—",
              label: "today",
              tone: "orange",
            },
          ]}
        >
          <div className="flex flex-col gap-4">
            <Table
              columns={columns}
              rows={query.data?.results ?? []}
              rowKey={(r) => r.id}
              onRowClick={(r) => router.push(`/payroll/runs/${r.id}`)}
              emptyMessage="No payroll runs yet."
            />
            {query.data ? (
              <Pagination page={page} pageSize={PAGE_SIZE} count={query.data.count} onPageChange={goToPage} />
            ) : null}
          </div>
        </ListLayout>
      )}

      <Dialog open={newOpen} onClose={() => setNewOpen(false)} title="New payroll run">
        <NewRunForm
          onDone={(id) => {
            setNewOpen(false);
            queryClient.invalidateQueries({ queryKey: payrollRunKeys.all });
            router.push(`/payroll/runs/${id}`);
          }}
        />
      </Dialog>
    </div>
  );
}
