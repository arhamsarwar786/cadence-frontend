"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createTask } from "@/features/tasks/actions";
import { taskKeys } from "@/features/tasks/api";
import { PERM } from "@/permissions/keys";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import { Button, Dialog, Field, Input, PermGate } from "@/shared/ui";

const schema = z.object({
  title: z.string().min(1, "Title is required."),
  due_date: z.string().optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;
const FIELD_NAMES = Object.keys(schema.shape);

type EntityKind = "client" | "employee";

/**
 * Creates a custom task linked to a client or worker. The manual create door
 * always yields type=custom; related_entity_* carries the follow-up target.
 */
export function LogFollowUpDialog({
  entityType,
  entityId,
  entityLabel,
  open,
  onClose,
  defaultTitle,
}: {
  entityType: EntityKind;
  entityId: string;
  entityLabel: string;
  open: boolean;
  onClose: () => void;
  defaultTitle?: string;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: defaultTitle ?? `Follow up — ${entityLabel}`,
      due_date: "",
    },
  });

  async function submit(values: FormValues) {
    setFormError(null);
    try {
      await createTask({
        title: values.title,
        due_date: values.due_date ? values.due_date.slice(0, 10) : null,
        related_entity_type: entityType,
        related_entity_id: entityId,
      });
      await queryClient.invalidateQueries({ queryKey: taskKeys.all });
      reset();
      onClose();
    } catch (error) {
      const matched = applyFieldErrors(setError, error, FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={entityType === "client" ? "Log client follow-up" : "Log worker follow-up"}
    >
      <p className="mb-4 font-body text-sm text-on-card-muted">
        Linked to {entityLabel}. Saved as a custom task with this {entityType} attached.
      </p>
      <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
        <Field label="Title" htmlFor="followup-title" error={errors.title?.message}>
          <Input id="followup-title" {...register("title")} />
        </Field>
        <Field label="Due date" htmlFor="followup-due" error={errors.due_date?.message}>
          <Input id="followup-due" type="date" {...register("due_date")} />
        </Field>
        {formError ? <p className="font-body text-sm text-cadence-red">{formError}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Log follow-up"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function LogFollowUpButton({
  entityType,
  entityId,
  entityLabel,
}: {
  entityType: EntityKind;
  entityId: string;
  entityLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <PermGate anyOf={PERM.TASKS_CREATE}>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Log follow-up
      </Button>
      <LogFollowUpDialog
        entityType={entityType}
        entityId={entityId}
        entityLabel={entityLabel}
        open={open}
        onClose={() => setOpen(false)}
      />
    </PermGate>
  );
}
