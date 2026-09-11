"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { addEducation, deleteEducation } from "@/features/workers/actions";
import { listWorkerEducation } from "@/features/workers/api";
import { educationSchema, type EducationFormValues } from "@/features/workers/schemas";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import { Button, Dialog, Field, Input } from "@/shared/ui";

const FIELD_NAMES = Object.keys(educationSchema.shape);

export function EducationPanel({ workerId }: { workerId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["workers", workerId, "education"] as const;
  const query = useQuery({ queryKey, queryFn: () => listWorkerEducation(workerId) });
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EducationFormValues>({
    // See AvailabilityPanel — z.coerce.number()'s input/output split vs.
    // zodResolver's Resolver<T>, not a real type error.
    resolver: zodResolver(educationSchema) as Resolver<EducationFormValues>,
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey });
  }

  async function submit(values: EducationFormValues) {
    setFormError(null);
    try {
      await addEducation(workerId, values);
      await invalidate();
      reset();
      setOpen(false);
    } catch (error) {
      const matched = applyFieldErrors(setError, error, FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
    }
  }

  async function handleDelete(rowId: string) {
    if (!window.confirm("Remove this education entry?")) return;
    await deleteEducation(workerId, rowId);
    await invalidate();
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-subheading text-xl text-cadence-ink">Education</h2>
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
                  {row.credential} — {row.institution}
                </p>
                <p className="font-body text-xs text-cadence-ink/60">
                  {[row.year, row.completed ? "Completed" : "In progress"].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => handleDelete(row.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-sm text-cadence-ink/60">No education on file.</p>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Add education">
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <Field label="Institution" htmlFor="edu-institution" error={errors.institution?.message}>
            <Input id="edu-institution" {...register("institution")} />
          </Field>
          <Field label="Credential" htmlFor="edu-credential" error={errors.credential?.message}>
            <Input id="edu-credential" {...register("credential")} />
          </Field>
          <Field label="Year" htmlFor="edu-year" error={errors.year?.message}>
            <Input id="edu-year" type="number" {...register("year")} />
          </Field>
          <label className="flex items-center gap-2 font-body text-sm text-cadence-ink">
            <input type="checkbox" {...register("completed")} />
            Completed
          </label>
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
