"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import {
  clearShiftMark,
  deleteShift,
  markShiftNotWorked,
  updateShift,
} from "@/features/jobs/actions";
import { getShift, shiftKeys } from "@/features/jobs/api";
import { ShiftStatusBadge } from "@/features/jobs/components/StatusBadges";
import {
  shiftEditSchema,
  shiftMarkSchema,
  type ShiftEditFormValues,
  type ShiftMarkFormValues,
} from "@/features/jobs/schemas";
import type { Shift } from "@/features/jobs/types";
import { PERM } from "@/permissions/keys";
import { formatTimeRange } from "@/shared/lib/datetime";
import { applyFieldErrors, isNotFound, messageFrom } from "@/shared/lib/errors";
import {
  SHIFT_NOT_WORKED_REASON_LABELS,
  type ShiftNotWorkedReason,
  type ShiftStatus,
} from "@/shared/lib/status-labels";
import {
  Button,
  Dialog,
  Field,
  Input,
  Loading,
  PageFrame,
  PageHeader,
  PageScrollRegion,
  PermGate,
  QueryError,
  Select,
  useConfirm,
  useToast,
} from "@/shared/ui";

const EDIT_FIELD_NAMES = Object.keys(shiftEditSchema.shape);
const MARK_FIELD_NAMES = Object.keys(shiftMarkSchema.shape);

/** "09:00:00" -> "09:00" for a time input. */
function hhmm(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : "";
}

function ShiftEditForm({
  shift,
  onSaved,
  onCancel,
}: {
  shift: Shift;
  onSaved: (shift: Shift) => void;
  onCancel: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ShiftEditFormValues>({
    resolver: zodResolver(shiftEditSchema),
    defaultValues: {
      shift_date: shift.shift_date,
      start_time: hhmm(shift.start_time),
      end_time: hhmm(shift.end_time),
      break_minutes: String(shift.break_minutes ?? 0),
    },
  });

  async function submit(values: ShiftEditFormValues) {
    setFormError(null);
    try {
      const saved = await updateShift(shift.id, {
        shift_date: values.shift_date,
        start_time: values.start_time,
        end_time: values.end_time,
        break_minutes: Number(values.break_minutes),
      });
      onSaved(saved);
    } catch (error) {
      const banner = applyFieldErrors(setError, error, EDIT_FIELD_NAMES);
      if (banner) setFormError(banner);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(submit)}
      noValidate
      aria-label="Edit shift"
      className="flex max-w-xl flex-col gap-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Date" htmlFor="shift-date" error={errors.shift_date?.message}>
          <Input id="shift-date" type="date" {...register("shift_date")} />
        </Field>
        <Field label="Break (minutes)" htmlFor="shift-break" error={errors.break_minutes?.message}>
          <Input
            id="shift-break"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            {...register("break_minutes")}
          />
        </Field>
        <Field label="Start time" htmlFor="shift-start" error={errors.start_time?.message}>
          <Input id="shift-start" type="time" {...register("start_time")} />
        </Field>
        <Field label="End time" htmlFor="shift-end" error={errors.end_time?.message}>
          <Input id="shift-end" type="time" {...register("end_time")} />
        </Field>
      </div>
      {shift.generated ? (
        <p className="font-body text-xs text-cadence-ink/60">
          This shift was generated from the job&apos;s pattern — regenerating shifts realigns it to
          the pattern. For a lasting change, edit the pattern.
        </p>
      ) : null}
      {formError ? (
        <p role="alert" className="font-body text-sm text-cadence-red">
          {formError}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function MarkNotWorkedForm({
  shiftId,
  onDone,
  onCancel,
}: {
  shiftId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ShiftMarkFormValues>({ resolver: zodResolver(shiftMarkSchema) });

  async function submit(values: ShiftMarkFormValues) {
    setFormError(null);
    try {
      await markShiftNotWorked(shiftId, values);
      onDone();
    } catch (error) {
      const banner = applyFieldErrors(setError, error, MARK_FIELD_NAMES);
      if (banner) setFormError(banner);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
      <Field label="Reason" htmlFor="detail-mark-reason" error={errors.reason?.message}>
        <Select id="detail-mark-reason" {...register("reason")}>
          {Object.entries(SHIFT_NOT_WORKED_REASON_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      {formError ? (
        <p role="alert" className="font-body text-sm text-cadence-red">
          {formError}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-cadence-ink/60">{label}</dt>
      <dd className="break-words text-cadence-ink">{children}</dd>
    </div>
  );
}

export default function ShiftDetailPage() {
  const { id: shiftId } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [editing, setEditing] = useState(false);
  const [markOpen, setMarkOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: shiftKeys.detail(shiftId),
    queryFn: () => getShift(shiftId),
    retry: false,
  });

  if (query.isError && isNotFound(query.error)) notFound();

  async function refresh(next?: Shift) {
    if (next) queryClient.setQueryData(shiftKeys.detail(shiftId), next);
    await queryClient.invalidateQueries({ queryKey: shiftKeys.all });
    // The job page reads its shifts under its own key.
    await queryClient.invalidateQueries({ queryKey: ["jobs"] });
  }

  async function handleClearMark() {
    setActionError(null);
    setBusy(true);
    try {
      const next = await clearShiftMark(shiftId);
      await refresh(next);
      toast.success("Mark cleared — the shift is scheduled again.");
    } catch (error) {
      setActionError(messageFrom(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(shift: Shift) {
    const ok = await confirm({
      title: "Delete this shift?",
      body: shift.generated
        ? "The shift is removed from the schedule. It was generated from the job's pattern, so regenerating shifts brings it back while the pattern still wants it."
        : "The shift is removed from the schedule. This cannot be undone.",
      confirmLabel: "Delete shift",
      danger: true,
    });
    if (!ok) return;
    setActionError(null);
    setBusy(true);
    try {
      await deleteShift(shiftId);
      queryClient.removeQueries({ queryKey: shiftKeys.detail(shiftId) });
      await queryClient.invalidateQueries({ queryKey: shiftKeys.all });
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Shift deleted.");
      // replace: Back must not land on the deleted shift's 404.
      router.replace(`/shifts?job=${shift.job_id}`);
    } catch (error) {
      setActionError(messageFrom(error));
      setBusy(false);
    }
  }

  if (query.isLoading) return <Loading />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => query.refetch()} />;
  const shift = query.data;
  if (!shift) return null;

  const status = (shift.status ?? "scheduled") as ShiftStatus;
  const editable = status === "scheduled" && shift.hours == null;
  const timeRange = formatTimeRange(shift.start_time, shift.end_time);

  return (
    <PageFrame>
      <PageHeader
        title={shift.job_title}
        meta={
          <>
            <ShiftStatusBadge status={status} />
            <span className="font-body text-sm text-cadence-ink/60">
              {shift.shift_date} · {timeRange}
              {shift.is_overnight ? " (overnight)" : ""}
            </span>
            <span className="font-body text-sm text-cadence-ink/60">{shift.employee_name}</span>
          </>
        }
        actions={
          <PermGate anyOf={PERM.SHIFTS_EDIT}>
            {editable ? (
              <>
                {!editing ? (
                  <Button variant="secondary" onClick={() => setEditing(true)} disabled={busy}>
                    Edit
                  </Button>
                ) : null}
                <Button variant="secondary" onClick={() => setMarkOpen(true)} disabled={busy}>
                  Mark not worked
                </Button>
                <Button variant="danger" onClick={() => handleDelete(shift)} disabled={busy}>
                  Delete
                </Button>
              </>
            ) : status === "not_worked" ? (
              <Button variant="secondary" onClick={handleClearMark} disabled={busy}>
                Clear mark
              </Button>
            ) : null}
          </PermGate>
        }
      />
      <PageScrollRegion className="flex flex-col gap-8">
        {actionError ? (
          <p role="alert" className="font-body text-sm text-cadence-red">
            {actionError}
          </p>
        ) : null}

        {editing && editable ? (
          <section className="flex flex-col gap-3" aria-labelledby="shift-edit-heading">
            <h2 id="shift-edit-heading" className="font-subheading text-xl text-cadence-ink">
              Edit shift
            </h2>
            <ShiftEditForm
              shift={shift}
              onCancel={() => setEditing(false)}
              onSaved={async (next) => {
                setEditing(false);
                await refresh(next);
                toast.success("Shift updated.");
              }}
            />
          </section>
        ) : (
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-3 font-body text-sm min-[420px]:grid-cols-2">
            <Detail label="Job">
              <Link href={`/jobs/${shift.job_id}`} className="underline underline-offset-2">
                {shift.job_title}
              </Link>
            </Detail>
            <Detail label="Employee">
              <Link href={`/workers/${shift.employee_id}`} className="underline underline-offset-2">
                {shift.employee_name}
              </Link>
            </Detail>
            <Detail label="Date">{shift.shift_date}</Detail>
            <Detail label="Time">
              {timeRange}
              {shift.is_overnight ? " (overnight)" : ""}
            </Detail>
            <Detail label="Break">{shift.break_minutes ?? 0} min</Detail>
            <Detail label="Scheduled hours">{shift.scheduled_hours}</Detail>
            <Detail label="Reported hours">{shift.hours ?? "—"}</Detail>
            {status === "not_worked" && shift.reason ? (
              <Detail label="Reason">
                {SHIFT_NOT_WORKED_REASON_LABELS[shift.reason as ShiftNotWorkedReason] ??
                  shift.reason}
              </Detail>
            ) : null}
            <Detail label="Source">{shift.generated ? "Job pattern" : "Added by hand"}</Detail>
          </dl>
        )}

        {status === "worked" || shift.hours != null ? (
          <p className="max-w-xl font-body text-xs text-cadence-ink/60">
            This shift carries approved hours, so it is pay evidence and can&apos;t be edited or
            deleted. Unapprove its hour sheet first.
          </p>
        ) : status === "not_worked" ? (
          <p className="max-w-xl font-body text-xs text-cadence-ink/60">
            A marked shift is attendance history. Clear the mark to edit or delete it.
          </p>
        ) : null}
      </PageScrollRegion>

      <Dialog open={markOpen} onClose={() => setMarkOpen(false)} title="Mark not worked">
        {markOpen ? (
          <MarkNotWorkedForm
            shiftId={shift.id}
            onCancel={() => setMarkOpen(false)}
            onDone={async () => {
              setMarkOpen(false);
              await refresh();
              toast.success("Shift marked not worked.");
            }}
          />
        ) : null}
      </Dialog>
      {confirmDialog}
    </PageFrame>
  );
}
