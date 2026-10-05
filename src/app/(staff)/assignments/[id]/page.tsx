"use client";

import { Loading } from "@/shared/ui/Loading";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notFound, useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import {
  confirmAssignment,
  createShiftForAssignment,
  notifyClientAssignment,
  refreshAssignmentRate,
  withdrawAssignment,
} from "@/features/jobs/actions";
import { getAssignment, listShifts } from "@/features/jobs/api";
import { AssignmentStatusBadge, ShiftStatusBadge } from "@/features/jobs/components/StatusBadges";
import { useOrgTimeZone } from "@/auth/use-org-timezone";
import { formatDateTime, formatTimeRange } from "@/shared/lib/datetime";
import { applyFieldErrors, isNotFound, messageFrom } from "@/shared/lib/errors";
import { formatMoney } from "@/shared/lib/money";
import type { AssignmentStatus, ShiftStatus } from "@/shared/lib/status-labels";
import { PERM } from "@/permissions/keys";
import { Button, Field, Input, PageFrame, PageHeader, PageScrollRegion, PermGate, QueryError, Table, useConfirm, useToast, type Column } from "@/shared/ui";
import { optionalNumber } from "@/shared/lib/zod-helpers";
import { z } from "zod";
import { fetchAllPages } from "@/api/client";

const shiftSchema = z.object({
  shift_date: z.string().min(1, "Date is required."),
  start_time: z.string().min(1, "Start time is required."),
  end_time: z.string().min(1, "End time is required."),
  break_minutes: optionalNumber(z.coerce.number().int().min(0)),
});
type ShiftFormValues = z.infer<typeof shiftSchema>;
const FIELD_NAMES = Object.keys(shiftSchema.shape);

export default function AssignmentDetailPage() {
  const { id: assignmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Approval releases the notice to the send queue; `client_notified_at` is
  // only stamped once the email actually leaves, so the approval itself is
  // remembered here to show the sent state and retire the action.
  const [noticeApproved, setNoticeApproved] = useState(false);
  const toast = useToast();
  const timeZone = useOrgTimeZone();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const query = useQuery({
    queryKey: ["assignments", assignmentId],
    queryFn: () => getAssignment(assignmentId),
    retry: false,
  });

  const shiftsQuery = useQuery({
    queryKey: ["assignments", assignmentId, "shifts"],
    queryFn: () =>
      fetchAllPages((page) =>
        listShifts({ job: query.data?.job_id, employee: query.data?.employee_id, pageSize: 200, page }),
      ),
    enabled: Boolean(query.data),
  });

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftSchema) as Resolver<ShiftFormValues>,
  });

  if (query.isError && isNotFound(query.error)) notFound();

  function refetch() {
    return queryClient.invalidateQueries({ queryKey: ["assignments", assignmentId] });
  }

  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await confirmAssignment(assignmentId);
      await refetch();
    } catch (error) {
      setActionError(messageFrom(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleWithdraw() {
    const ok = await confirm({
      title: "Withdraw this assignment?",
      body: "The placement is removed. This is not a third status — decline/withdraw deletes the offer.",
      confirmLabel: "Withdraw",
      danger: true,
    });
    if (!ok) return;
    setActionError(null);
    try {
      await withdrawAssignment(assignmentId);
      router.back();
    } catch (error) {
      setActionError(messageFrom(error));
    }
  }

  async function handleNotifyClient() {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await notifyClientAssignment(assignmentId);
      setNoticeApproved(true);
      toast.success("Client notice approved and queued for sending.");
      await refetch();
    } catch (error) {
      setActionError(messageFrom(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleRefreshRate() {
    setActionError(null);
    try {
      await refreshAssignmentRate(assignmentId);
      await refetch();
    } catch (error) {
      setActionError(messageFrom(error));
    }
  }

  async function submitShift(values: ShiftFormValues) {
    setFormError(null);
    try {
      await createShiftForAssignment(assignmentId, {
        ...values,
        break_minutes: values.break_minutes ?? 0,
      });
      await queryClient.invalidateQueries({ queryKey: ["assignments", assignmentId, "shifts"] });
      reset();
    } catch (error) {
      const banner = applyFieldErrors(setError, error, FIELD_NAMES);
      if (banner) setFormError(banner);
    }
  }

  if (query.isLoading) return <Loading />;
  if (query.isError) {
    return <QueryError error={query.error} onRetry={() => query.refetch()} />;
  }
  const assignment = query.data;
  if (!assignment) return null;

  const shiftColumns: Column<NonNullable<typeof shiftsQuery.data>["results"][number]>[] = [
    { header: "Date", cell: (s) => s.shift_date },
    { header: "Time", cell: (s) => formatTimeRange(s.start_time, s.end_time) },
    { header: "Status", cell: (s) => <ShiftStatusBadge status={s.status as ShiftStatus} /> },
  ];

  return (
    <PageFrame>
      <PageHeader
        title={assignment.employee_name}
        meta={
          <>
            <AssignmentStatusBadge status={assignment.status as AssignmentStatus} />
            <span className="font-body text-sm text-cadence-ink/60">{assignment.job_title}</span>
          </>
        }
        actions={
          <>
            {assignment.status === "offered" ? (
              <PermGate anyOf={PERM.JOBS_ASSIGN}>
                <Button onClick={handleConfirm} disabled={busy}>
                  Confirm
                </Button>
              </PermGate>
            ) : null}
            <PermGate anyOf={PERM.JOBS_ASSIGN}>
              <Button variant="secondary" onClick={handleRefreshRate}>
                Refresh rate
              </Button>
            </PermGate>
            <PermGate anyOf={PERM.JOBS_ASSIGN}>
              <Button variant="danger" onClick={handleWithdraw}>
                Withdraw
              </Button>
            </PermGate>
          </>
        }
      />
      <PageScrollRegion className="flex flex-col gap-8">
        {actionError ? <p className="font-body text-sm text-cadence-red">{actionError}</p> : null}

        {assignment.client_notified_at ? (
          <p className="font-body text-sm text-cadence-ink/70">
            Client notified at{" "}
            {timeZone ? formatDateTime(assignment.client_notified_at, timeZone) : assignment.client_notified_at}.
          </p>
        ) : noticeApproved ? (
          <p role="status" className="font-body text-sm text-cadence-ink/70">
            Client notice approved — it is queued and will be emailed to the client shortly.
          </p>
        ) : assignment.status === "confirmed" ? (
          <PermGate anyOf={PERM.JOBS_CLIENT_NOTIFY}>
            <div className="rounded-2xl border border-cadence-orange/40 bg-cadence-orange/10 px-4 py-3">
              <p className="font-body text-sm text-cadence-ink">
                Client notice is held for approval after confirm. Approve &amp; send when ready.
              </p>
              <Button className="mt-2" size="sm" disabled={busy} onClick={handleNotifyClient}>
                Approve &amp; send client notice
              </Button>
            </div>
          </PermGate>
        ) : null}

        {assignment.warnings && assignment.warnings.length > 0 ? (
          <ul className="rounded-md border border-cadence-yellow bg-cadence-yellow/20 p-3 font-body text-sm text-cadence-ink">
            {assignment.warnings.map((w) => (
              <li key={w.code}>{w.detail}</li>
            ))}
          </ul>
        ) : null}

        <dl className="grid max-w-xl grid-cols-2 gap-x-8 gap-y-3 font-body text-sm">
          <div>
            <dt className="text-cadence-ink/60">Pay rate</dt>
            <dd className="text-cadence-ink">
              {"pay_rate" in assignment ? formatMoney(assignment.pay_rate) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-cadence-ink/60">Bill rate applied</dt>
            <dd className="text-cadence-ink">
              {"bill_rate_applied" in assignment
                ? `${formatMoney(assignment.bill_rate_applied)} / ${assignment.bill_rate_unit_applied}`
                : "—"}
            </dd>
          </div>
        </dl>

        <section className="flex flex-col gap-3">
          <h2 className="font-subheading text-xl text-cadence-ink">Shifts</h2>
          <Table
            columns={shiftColumns}
            rows={shiftsQuery.data?.results ?? []}
            rowKey={(s) => s.id}
            emptyMessage="No shifts yet."
          />
          <form onSubmit={handleSubmit(submitShift)} noValidate className="flex flex-wrap items-end gap-3">
            <Field label="Date" htmlFor="shift-date" error={errors.shift_date?.message}>
              <Input id="shift-date" type="date" {...register("shift_date")} />
            </Field>
            <Field label="Start" htmlFor="shift-start" error={errors.start_time?.message}>
              <Input id="shift-start" type="time" {...register("start_time")} />
            </Field>
            <Field label="End" htmlFor="shift-end" error={errors.end_time?.message}>
              <Input id="shift-end" type="time" {...register("end_time")} />
            </Field>
            <Field label="Break (minutes)" htmlFor="shift-break" error={errors.break_minutes?.message}>
              <Input id="shift-break" type="number" min={0} {...register("break_minutes")} />
            </Field>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? "Adding…" : "Add shift"}
            </Button>
          </form>
          {formError ? <p className="font-body text-sm text-cadence-red">{formError}</p> : null}
        </section>
        {confirmDialog}
      </PageScrollRegion>
    </PageFrame>
  );
}
