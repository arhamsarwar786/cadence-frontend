"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { createPayrollRun } from "@/features/money/actions";
import { listPayrollRuns, payrollRunKeys } from "@/features/money/api";
import { PayrollRunStatusBadge } from "@/features/money/components/StatusBadges";
import { payrollRunCreateSchema, type PayrollRunCreateFormValues } from "@/features/money/schemas";
import type { PayrollRun } from "@/features/money/types";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import type { PayrollRunStatus } from "@/shared/lib/status-labels";
import { Button, Dialog, Field, Input, Pagination, Table, type Column } from "@/shared/ui";

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
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const [newOpen, setNewOpen] = useState(false);

  const query = useQuery({
    queryKey: payrollRunKeys.list({ page }),
    queryFn: () => listPayrollRuns({ page, pageSize: PAGE_SIZE }),
  });

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(nextPage));
    router.push(`/payroll?${params.toString()}`);
  }

  const columns: Column<PayrollRun>[] = [
    { header: "Period", cell: (r) => `${r.period_start} – ${r.period_end}` },
    { header: "Payday", cell: (r) => r.payday },
    { header: "Status", cell: (r) => <PayrollRunStatusBadge status={r.status as PayrollRunStatus} /> },
    { header: "Paid", cell: (r) => (r.paid_at ? "Yes" : "No") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl text-cadence-ink">Pay statements</h1>
        <Button onClick={() => setNewOpen(true)}>New run</Button>
      </div>

      {query.isLoading ? (
        <p className="font-body text-sm text-cadence-ink/60">Loading…</p>
      ) : query.isError ? (
        <p className="font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>
      ) : (
        <>
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
        </>
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
