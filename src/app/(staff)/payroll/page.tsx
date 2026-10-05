"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { createPayrollRun, generatePayrollRun } from "@/features/money/actions";
import { listPayrollRuns, payrollRunKeys } from "@/features/money/api";
import { PayCyclesPanel } from "@/features/money/components/PayCyclesPanel";
import { PayrollRunStatusBadge } from "@/features/money/components/StatusBadges";
import { payrollRunCreateSchema, type PayrollRunCreateFormValues } from "@/features/money/schemas";
import type { PayrollRun } from "@/features/money/types";
import { useOrgTimeZone } from "@/auth/use-org-timezone";
import { ListError } from "@/features/jobs/components/ListError";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import type { PayrollRunStatus } from "@/shared/lib/status-labels";
import { PERM } from "@/permissions/keys";
import { Button, Dialog, Field, Input, ListLayout, ListSkeleton, PageHeader, Pagination, PermGate, Table, type Column, PageFrame, PageBody } from "@/shared/ui";

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
      const banner = applyFieldErrors(setError, error, FIELD_NAMES);
      if (banner) setFormError(banner);
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
  const [genError, setGenError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
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

  return (
    <PageFrame>
      <PageHeader
        title="Pay statements"
        actions={
          <div className="flex flex-wrap gap-2">
            <PermGate anyOf={PERM.PAYROLL_RUN}>
              <Button
                variant="secondary"
                disabled={generating}
                onClick={async () => {
                  if (generating) return;
                  setGenerating(true);
                  setGenError(null);
                  try {
                    const run = await generatePayrollRun();
                    await queryClient.invalidateQueries({ queryKey: payrollRunKeys.all });
                    router.push(`/payroll/runs/${run.id}`);
                  } catch (error) {
                    setGenError(messageFrom(error));
                  } finally {
                    setGenerating(false);
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

      <PayCyclesPanel />

      <PageBody>


        {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError ? (
        <ListError
            error={query.error}
            page={page}
            onRetry={() => query.refetch()}
            onFirstPage={() => goToPage(1)}
          />
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
          <div className="flex min-h-0 flex-col gap-4">
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
    </PageBody>
    </PageFrame>
  );
}
