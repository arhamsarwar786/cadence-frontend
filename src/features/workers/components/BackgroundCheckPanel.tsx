"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { setBackgroundCheck } from "@/features/workers/actions";
import { backgroundCheckSchema, type BackgroundCheckFormValues } from "@/features/workers/schemas";
import type { Employee } from "@/features/workers/types";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import { BACKGROUND_CHECK_STATUS_LABELS, type BackgroundCheckStatus } from "@/shared/lib/status-labels";
import { Button, Field, Select, Input } from "@/shared/ui";

const FIELD_NAMES = Object.keys(backgroundCheckSchema.shape);

/** Staff-only, never portal (ARCHITECTURE.md §9) — this component is only
 * ever mounted on the staff worker detail page, never the portal. */
export function BackgroundCheckPanel({
  worker,
  onRefetch,
}: {
  worker: Employee;
  onRefetch: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BackgroundCheckFormValues>({
    resolver: zodResolver(backgroundCheckSchema),
    defaultValues: {
      status: (worker.background_check_status as BackgroundCheckStatus) ?? "not_done",
      note: worker.background_check_note ?? "",
    },
  });

  if (!("background_check_status" in worker)) return null;

  async function submit(values: BackgroundCheckFormValues) {
    setFormError(null);
    try {
      await setBackgroundCheck(worker.id, { ...values, note: values.note ?? "" });
      setEditing(false);
      onRefetch();
    } catch (error) {
      const matched = applyFieldErrors(setError, error, FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-subheading text-xl text-cadence-ink">Background check</h2>
        {!editing ? (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
        ) : null}
      </div>

      {editing ? (
        <form onSubmit={handleSubmit(submit)} noValidate className="flex max-w-sm flex-col gap-4">
          <Field label="Status" htmlFor="bg-status" error={errors.status?.message}>
            <Select id="bg-status" {...register("status")}>
              <option value="not_done">Not done</option>
              <option value="good">Good</option>
              <option value="not_good">Not good</option>
            </Select>
          </Field>
          <Field label="Note" htmlFor="bg-note" error={errors.note?.message}>
            <Input id="bg-note" {...register("note")} />
          </Field>
          {formError ? <p className="font-body text-sm text-cadence-red">{formError}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <dl className="grid max-w-sm grid-cols-2 gap-x-8 gap-y-2 font-body text-sm">
          <div>
            <dt className="text-cadence-ink/60">Status</dt>
            <dd className="text-cadence-ink">
              {BACKGROUND_CHECK_STATUS_LABELS[worker.background_check_status as BackgroundCheckStatus]}
            </dd>
          </div>
          <div>
            <dt className="text-cadence-ink/60">Note</dt>
            <dd className="text-cadence-ink">{worker.background_check_note || "—"}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
