"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { addShiftPattern, deleteShiftPattern, regenerateShifts } from "@/features/jobs/actions";
import { listJobShiftPatterns } from "@/features/jobs/api";
import { shiftPatternSchema, type ShiftPatternFormValues } from "@/features/jobs/schemas";
import { DAYS_OF_WEEK } from "@/features/workers/schemas";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import { Button, Dialog, Field, Input, useConfirm } from "@/shared/ui";

const FIELD_NAMES = Object.keys(shiftPatternSchema.shape);
const DAY_LABEL = new Map<number, string>(DAYS_OF_WEEK.map((d) => [d.value, d.label]));

export function ShiftPatternsPanel({ jobId }: { jobId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["jobs", jobId, "shift-patterns"] as const;
  const query = useQuery({ queryKey, queryFn: () => listJobShiftPatterns(jobId) });
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ShiftPatternFormValues>({
    resolver: zodResolver(shiftPatternSchema) as Resolver<ShiftPatternFormValues>,
    defaultValues: { days_of_week: [] },
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey });
  }

  async function submit(values: ShiftPatternFormValues) {
    setFormError(null);
    try {
      await addShiftPattern(jobId, values);
      await invalidate();
      reset({ days_of_week: [] });
      setOpen(false);
    } catch (error) {
      const matched = applyFieldErrors(setError, error, FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: "Remove this shift pattern?",
      body: "The pattern will be deleted. Existing generated shifts are unchanged until you regenerate.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    await deleteShiftPattern(jobId, id);
    await invalidate();
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      await regenerateShifts(jobId);
      await queryClient.invalidateQueries({ queryKey: ["jobs", jobId, "assignments"] });
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-subheading text-xl text-cadence-ink">Shift patterns</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" disabled={regenerating} onClick={handleRegenerate}>
            {regenerating ? "Regenerating…" : "Regenerate shifts"}
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            Add pattern
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <p className="font-body text-sm text-cadence-ink/60">Loading…</p>
      ) : query.data && query.data.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {query.data.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3">
              <p className="font-body text-sm text-cadence-ink">
                {p.days_of_week.map((d) => DAY_LABEL.get(d)).join(", ")} · {p.start_time}–
                {p.end_time}
                {p.is_overnight ? " (overnight)" : ""}
              </p>
              <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-sm text-cadence-ink/60">No shift patterns set.</p>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Add shift pattern">
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <Field label="Days" htmlFor="pattern-days" error={errors.days_of_week?.message}>
            <div className="flex flex-wrap gap-3">
              {DAYS_OF_WEEK.map((d) => (
                <label key={d.value} className="flex items-center gap-1 font-body text-sm text-cadence-ink">
                  <input type="checkbox" value={d.value} {...register("days_of_week")} />
                  {d.label.slice(0, 3)}
                </label>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start time" htmlFor="pattern-start" error={errors.start_time?.message}>
              <Input id="pattern-start" type="time" {...register("start_time")} />
            </Field>
            <Field label="End time" htmlFor="pattern-end" error={errors.end_time?.message}>
              <Input id="pattern-end" type="time" {...register("end_time")} />
            </Field>
          </div>
          <Field label="Break (minutes)" htmlFor="pattern-break" error={errors.break_minutes?.message}>
            <Input id="pattern-break" type="number" min={0} {...register("break_minutes")} />
          </Field>
          {formError ? <p className="font-body text-sm text-cadence-red">{formError}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>
      {confirmDialog}
    </section>
  );
}
