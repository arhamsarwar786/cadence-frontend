"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { clearShiftMark, getShiftBackfill, markShiftNotWorked } from "@/features/jobs/actions";
import { listShifts, shiftKeys } from "@/features/jobs/api";
import { ShiftStatusBadge } from "@/features/jobs/components/StatusBadges";
import { shiftMarkSchema, type ShiftMarkFormValues } from "@/features/jobs/schemas";
import type { Shift } from "@/features/jobs/types";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import type { ShiftStatus } from "@/shared/lib/status-labels";
import { Button, Dialog, Field, Input, ListSkeleton, Pagination, Select, Table, type Column } from "@/shared/ui";

const PAGE_SIZE = 50;
const FIELD_NAMES = Object.keys(shiftMarkSchema.shape);

export default function ShiftsListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const [markTarget, setMarkTarget] = useState<Shift | null>(null);
  const [backfillTarget, setBackfillTarget] = useState<Shift | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const backfillQuery = useQuery({
    queryKey: ["shift-backfill", backfillTarget?.id],
    queryFn: () => getShiftBackfill(backfillTarget!.id),
    enabled: Boolean(backfillTarget),
  });

  const listParams = { page, pageSize: PAGE_SIZE, from: from || undefined, to: to || undefined };
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
      const matched = applyFieldErrors(setError, error, FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
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
              <Button size="sm" variant="secondary" onClick={() => handleClearMark(s)}>
                Clear mark
              </Button>
              <Button size="sm" onClick={() => setBackfillTarget(s)}>
                Backfill
              </Button>
            </>
          ) : null}
          {s.status === "scheduled" ? (
            <Button size="sm" variant="secondary" onClick={() => setMarkTarget(s)}>
              Mark not worked
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
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
      </div>

      {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError ? (
        <p className="font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>
      ) : (
        <>
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
        </>
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
          <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
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
    </div>
  );
}
