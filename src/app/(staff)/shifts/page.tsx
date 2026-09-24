"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { clearShiftMark, getShiftBackfill, markShiftNotWorked } from "@/features/jobs/actions";
import { listJobs, listShifts, shiftKeys } from "@/features/jobs/api";
import { ShiftStatusBadge } from "@/features/jobs/components/StatusBadges";
import { shiftMarkSchema, type ShiftMarkFormValues } from "@/features/jobs/schemas";
import type { Shift } from "@/features/jobs/types";
import { listWorkers } from "@/features/workers/api";
import { PERM } from "@/permissions/keys";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import type { ShiftStatus } from "@/shared/lib/status-labels";
import {
  Button,
  Dialog,
  Field,
  Input,
  ListLayout,
  ListSkeleton,
  PageBody,
  PageFrame,
  Pagination,
  PermGate,
  Select,
  Table,
  type Column,
} from "@/shared/ui";

const PAGE_SIZE = 50;
const FIELD_NAMES = Object.keys(shiftMarkSchema.shape);

export default function ShiftsListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const job = searchParams.get("job") ?? "";
  const employee = searchParams.get("employee") ?? "";
  const [markTarget, setMarkTarget] = useState<Shift | null>(null);
  const [backfillTarget, setBackfillTarget] = useState<Shift | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const jobsQuery = useQuery({
    queryKey: ["jobs-picker"],
    queryFn: () => listJobs({ pageSize: 200 }),
  });
  const workersQuery = useQuery({
    queryKey: ["workers-picker"],
    queryFn: () => listWorkers({ pageSize: 200 }),
  });

  const backfillQuery = useQuery({
    queryKey: ["shift-backfill", backfillTarget?.id],
    queryFn: () => getShiftBackfill(backfillTarget!.id),
    enabled: Boolean(backfillTarget),
  });

  const listParams = {
    page,
    pageSize: PAGE_SIZE,
    from: from || undefined,
    to: to || undefined,
    job: job || undefined,
    employee: employee || undefined,
  };
  const query = useQuery({
    queryKey: shiftKeys.list(listParams),
    queryFn: () => listShifts(listParams),
  });

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ShiftMarkFormValues>({ resolver: zodResolver(shiftMarkSchema) });

  function setParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`/shifts?${params.toString()}`);
  }

  function goToPage(nextPage: number) {
    setParams({ page: String(nextPage) });
  }

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: shiftKeys.all });
  }

  async function submitMark(values: ShiftMarkFormValues) {
    if (!markTarget) return;
    setFormError(null);
    try {
      await markShiftNotWorked(markTarget.id, values);
      await invalidate();
      reset();
      setMarkTarget(null);
    } catch (error) {
      const banner = applyFieldErrors(setError, error, FIELD_NAMES);
      if (banner) setFormError(banner);
    }
  }

  async function handleClearMark(shift: Shift) {
    await clearShiftMark(shift.id);
    await invalidate();
  }

  const shiftColumns: Column<Shift>[] = [
    { header: "Date", cell: (s) => s.shift_date },
    { header: "Job", cell: (s) => s.job_title },
    { header: "Employee", cell: (s) => s.employee_name },
    { header: "Time", cell: (s) => `${s.start_time}–${s.end_time}` },
    { header: "Status", cell: (s) => <ShiftStatusBadge status={s.status as ShiftStatus} /> },
    {
      header: "Actions",
      cell: (s) => (
        <div className="flex flex-wrap gap-2">
          {s.status === "not_worked" ? (
            <>
              <PermGate anyOf={PERM.SHIFTS_EDIT}>
                <Button size="sm" variant="secondary" onClick={() => handleClearMark(s)}>
                  Clear mark
                </Button>
              </PermGate>
              <PermGate anyOf={PERM.SHIFTS_EDIT}>
                <Button size="sm" onClick={() => setBackfillTarget(s)}>
                  Backfill
                </Button>
              </PermGate>
            </>
          ) : null}
          {s.status === "scheduled" ? (
            <PermGate anyOf={PERM.SHIFTS_EDIT}>
              <Button size="sm" variant="secondary" onClick={() => setMarkTarget(s)}>
                Mark not worked
              </Button>
            </PermGate>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <PageFrame>
      <h1 className="mb-0 font-heading text-3xl text-cadence-ink">Shifts</h1>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="From" htmlFor="shifts-from">
          <Input
            id="shifts-from"
            type="date"
            value={from}
            onChange={(e) => setParams({ from: e.target.value || null, page: "1" })}
          />
        </Field>
        <Field label="To" htmlFor="shifts-to">
          <Input
            id="shifts-to"
            type="date"
            value={to}
            onChange={(e) => setParams({ to: e.target.value || null, page: "1" })}
          />
        </Field>
        <Field label="Job" htmlFor="shifts-job">
          <Select
            id="shifts-job"
            value={job}
            onChange={(e) => setParams({ job: e.target.value || null, page: "1" })}
          >
            <option value="">All jobs</option>
            {(jobsQuery.data?.results ?? []).map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Employee" htmlFor="shifts-employee">
          <Select
            id="shifts-employee"
            value={employee}
            onChange={(e) => setParams({ employee: e.target.value || null, page: "1" })}
          >
            <option value="">All employees</option>
            {(workersQuery.data?.results ?? []).map((w) => (
              <option key={w.id} value={w.id}>
                {w.first_name} {w.last_name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <PageBody>


        {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError ? (
        <p className="font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>
      ) : (
        <ListLayout>
          <div className="flex flex-col gap-4">
            <Table
              columns={shiftColumns}
              rows={query.data?.results ?? []}
              rowKey={(s) => s.id}
              emptyMessage="No shifts."
            />
            {query.data ? (
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                count={query.data.count}
                onPageChange={goToPage}
              />
            ) : null}
          </div>
        </ListLayout>
      )}

      <Dialog open={markTarget !== null} onClose={() => setMarkTarget(null)} title="Mark not worked">
        <form onSubmit={handleSubmit(submitMark)} noValidate className="flex flex-col gap-4">
          <Field label="Reason" htmlFor="mark-reason" error={errors.reason?.message}>
            <Select id="mark-reason" {...register("reason")}>
              <option value="no_show">No-show</option>
              <option value="excused">Excused</option>
              <option value="client_cancelled">Client cancelled</option>
            </Select>
          </Field>
          {formError ? <p className="font-body text-sm text-cadence-red">{formError}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setMarkTarget(null)}>
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={backfillTarget !== null}
        onClose={() => setBackfillTarget(null)}
        title="Who can cover this shift"
      >
        {backfillQuery.isLoading ? (
          <p className="text-sm text-on-card-muted">Loading…</p>
        ) : backfillQuery.isError ? (
          <p className="text-sm text-cadence-red">{messageFrom(backfillQuery.error)}</p>
        ) : (
          <ul className="scroll-area-y flex max-h-[min(18rem,50dvh)] flex-col gap-2">
            {(backfillQuery.data?.results ?? []).map((c) => {
              const name =
                c.employee_name ??
                [c.first_name, c.last_name].filter(Boolean).join(" ") ??
                c.id;
              return (
                <li
                  key={c.id}
                  className="rounded-xl border border-white/10 bg-card-muted px-3 py-2 font-body text-sm text-on-card"
                >
                  {name}
                </li>
              );
            })}
            {(backfillQuery.data?.results ?? []).length === 0 ? (
              <li className="text-sm text-on-card-muted">No candidates available.</li>
            ) : null}
          </ul>
        )}
      </Dialog>
    </PageBody>
    </PageFrame>
  );
}
