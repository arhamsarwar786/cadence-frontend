"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { addEmploymentHistory, deleteEmploymentHistory } from "@/features/workers/actions";
import { listWorkerEmploymentHistory } from "@/features/workers/api";
import {
  employmentHistorySchema,
  type EmploymentHistoryFormValues,
} from "@/features/workers/schemas";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import { Button, Dialog, Field, Input } from "@/shared/ui";

const FIELD_NAMES = Object.keys(employmentHistorySchema.shape);

export function EmploymentHistoryPanel({ workerId }: { workerId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["workers", workerId, "employment-history"] as const;
  const query = useQuery({ queryKey, queryFn: () => listWorkerEmploymentHistory(workerId) });
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EmploymentHistoryFormValues>({ resolver: zodResolver(employmentHistorySchema) });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey });
  }

  async function submit(values: EmploymentHistoryFormValues) {
    setFormError(null);
    try {
      await addEmploymentHistory(workerId, {
        ...values,
        job_title: values.job_title || undefined,
        started_on: values.started_on || undefined,
        ended_on: values.ended_on || undefined,
        supervisor_name: values.supervisor_name || undefined,
        supervisor_phone: values.supervisor_phone || undefined,
        supervisor_email: values.supervisor_email || undefined,
      });
      await invalidate();
      reset();
      setOpen(false);
    } catch (error) {
      const matched = applyFieldErrors(setError, error, FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
    }
  }

  async function handleDelete(rowId: string) {
    if (!window.confirm("Remove this employment history entry?")) return;
    await deleteEmploymentHistory(workerId, rowId);
    await invalidate();
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-subheading text-xl text-cadence-ink">Employment history</h2>
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
              <div>
                <p className="font-body text-sm font-medium text-cadence-ink">
                  {row.job_title ? `${row.job_title} — ` : ""}
                  {row.employer_name}
                </p>
                <p className="font-body text-xs text-cadence-ink/60">
                  {[row.started_on, row.ended_on ?? "Present"].filter(Boolean).join(" – ")}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => handleDelete(row.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-sm text-cadence-ink/60">No employment history on file.</p>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Add employment history">
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <Field label="Employer" htmlFor="eh-employer" error={errors.employer_name?.message}>
            <Input id="eh-employer" {...register("employer_name")} />
          </Field>
          <Field label="Job title" htmlFor="eh-title" error={errors.job_title?.message}>
            <Input id="eh-title" {...register("job_title")} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Started" htmlFor="eh-started" error={errors.started_on?.message}>
              <Input id="eh-started" type="date" {...register("started_on")} />
            </Field>
            <Field label="Ended" htmlFor="eh-ended" error={errors.ended_on?.message}>
              <Input id="eh-ended" type="date" {...register("ended_on")} />
            </Field>
          </div>
          <Field label="Supervisor name" htmlFor="eh-sup-name" error={errors.supervisor_name?.message}>
            <Input id="eh-sup-name" {...register("supervisor_name")} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Supervisor phone" htmlFor="eh-sup-phone" error={errors.supervisor_phone?.message}>
              <Input id="eh-sup-phone" {...register("supervisor_phone")} />
            </Field>
            <Field label="Supervisor email" htmlFor="eh-sup-email" error={errors.supervisor_email?.message}>
              <Input id="eh-sup-email" type="email" {...register("supervisor_email")} />
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
    </section>
  );
}
