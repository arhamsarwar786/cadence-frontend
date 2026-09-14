"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { addAvailability, deleteAvailability } from "@/features/workers/actions";
import { listWorkerAvailability } from "@/features/workers/api";
import {
  availabilitySchema,
  DAYS_OF_WEEK,
  type AvailabilityFormValues,
} from "@/features/workers/schemas";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import { Button, Dialog, Field, Input, Select, useConfirm } from "@/shared/ui";

const FIELD_NAMES = Object.keys(availabilitySchema.shape);
const DAY_LABEL = new Map(DAYS_OF_WEEK.map((d) => [d.value, d.label]));

export function AvailabilityPanel({ workerId }: { workerId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["workers", workerId, "availability"] as const;
  const query = useQuery({ queryKey, queryFn: () => listWorkerAvailability(workerId) });
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AvailabilityFormValues>({
    // z.coerce.number() gives zodResolver an input type (string) that
    // differs from its output type (number); RHF's Resolver<T> wants both
    // to match its own TFieldValues. The cast papers over that mismatch,
    // not a real type error — the coercion is exactly what a number
    // <input>'s string value needs.
    resolver: zodResolver(availabilitySchema) as Resolver<AvailabilityFormValues>,
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey });
  }

  async function submit(values: AvailabilityFormValues) {
    setFormError(null);
    try {
      // Zod validated day_of_week into the 1-7 range; the API's type is
      // the literal union rather than plain number.
      await addAvailability(workerId, values as Parameters<typeof addAvailability>[1]);
      await invalidate();
      reset();
      setOpen(false);
    } catch (error) {
      const matched = applyFieldErrors(setError, error, FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
    }
  }

  async function handleDelete(rowId: string) {
    const ok = await confirm({
      title: "Remove this availability window?",
      body: "This window will be deleted from the worker profile.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    await deleteAvailability(workerId, rowId);
    await invalidate();
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-subheading text-xl text-cadence-ink">Availability</h2>
        <Button size="sm" onClick={() => setOpen(true)}>
          Add window
        </Button>
      </div>

      {query.isLoading ? (
        <p className="font-body text-sm text-cadence-ink/60">Loading…</p>
      ) : query.data && query.data.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {query.data.map((row) => (
            <li key={row.id} className="flex items-center justify-between px-4 py-3">
              <p className="font-body text-sm text-cadence-ink">
                {DAY_LABEL.get(row.day_of_week)} · {row.start_time}–{row.end_time}
              </p>
              <Button size="sm" variant="ghost" onClick={() => handleDelete(row.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-sm text-cadence-ink/60">No availability set.</p>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Add availability window">
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <Field label="Day" htmlFor="avail-day" error={errors.day_of_week?.message}>
            <Select id="avail-day" {...register("day_of_week")}>
              {DAYS_OF_WEEK.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Start time" htmlFor="avail-start" error={errors.start_time?.message}>
            <Input id="avail-start" type="time" {...register("start_time")} />
          </Field>
          <Field label="End time" htmlFor="avail-end" error={errors.end_time?.message}>
            <Input id="avail-end" type="time" {...register("end_time")} />
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
