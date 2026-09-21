"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { addTimeOff, deleteTimeOff } from "@/features/workers/actions";
import { listWorkerTimeOff } from "@/features/workers/api";
import { timeOffSchema, type TimeOffFormValues } from "@/features/workers/schemas";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import { TIME_OFF_TYPE_LABELS } from "@/shared/lib/status-labels";
import { Button, Dialog, Field, Input, Select, useConfirm } from "@/shared/ui";

const FIELD_NAMES = Object.keys(timeOffSchema.shape);

export function TimeOffPanel({ workerId }: { workerId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["workers", workerId, "time-off"] as const;
  const query = useQuery({ queryKey, queryFn: () => listWorkerTimeOff(workerId) });
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TimeOffFormValues>({ resolver: zodResolver(timeOffSchema) });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey });
  }

  async function submit(values: TimeOffFormValues) {
    setFormError(null);
    try {
      await addTimeOff(workerId, values);
      await invalidate();
      reset();
      setOpen(false);
    } catch (error) {
      const formMessage = applyFieldErrors(setError, error, FIELD_NAMES);
      if (formMessage) setFormError(formMessage);
    }
  }

  async function handleDelete(rowId: string) {
    const ok = await confirm({
      title: "Remove this time-off entry?",
      body: "This record will be deleted from the worker profile.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    await deleteTimeOff(workerId, rowId);
    await invalidate();
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-subheading text-xl text-cadence-ink">Time off</h2>
        <Button size="sm" onClick={() => setOpen(true)}>
          Add entry
        </Button>
      </div>

      {query.isLoading ? (
        <p className="font-body text-sm text-cadence-ink/60">Loading…</p>
      ) : query.data && query.data.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {query.data.map((row) => (
            <li key={row.id} className="flex items-center justify-between px-4 py-3">
              <p className="font-body text-sm text-cadence-ink">
                {TIME_OFF_TYPE_LABELS[row.type]} · {row.start_date} – {row.end_date}
              </p>
              <Button size="sm" variant="ghost" onClick={() => handleDelete(row.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-sm text-cadence-ink/60">No time off on file.</p>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Add time off">
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <Field label="Type" htmlFor="to-type" error={errors.type?.message}>
            <Select id="to-type" {...register("type")}>
              <option value="vacation">Vacation</option>
              <option value="sick">Sick</option>
              <option value="personal">Personal</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start date" htmlFor="to-start" error={errors.start_date?.message}>
              <Input id="to-start" type="date" {...register("start_date")} />
            </Field>
            <Field label="End date" htmlFor="to-end" error={errors.end_date?.message}>
              <Input id="to-end" type="date" {...register("end_date")} />
            </Field>
          </div>
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
