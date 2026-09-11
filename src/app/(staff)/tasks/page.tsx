"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { completeTask, createTask, reopenTask } from "@/features/tasks/actions";
import { listTasks, taskKeys } from "@/features/tasks/api";
import type { Task } from "@/features/tasks/types";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import {
  MIRRORED_TASK_TYPES,
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
  type TaskStatus,
  type TaskType,
} from "@/shared/lib/status-labels";
import { Badge, Button, Dialog, Field, Input } from "@/shared/ui";

const taskSchema = z.object({
  title: z.string().min(1, "Title is required."),
  due_date: z.string().optional().or(z.literal("")),
});
type TaskFormValues = z.infer<typeof taskSchema>;
const FIELD_NAMES = Object.keys(taskSchema.shape);

export default function TasksPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: taskKeys.list(), queryFn: () => listTasks({ pageSize: 200 }) });
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({ resolver: zodResolver(taskSchema) });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: taskKeys.all });
  }

  async function submit(values: TaskFormValues) {
    setFormError(null);
    try {
      await createTask({ title: values.title, due_date: values.due_date || undefined });
      await invalidate();
      reset();
      setOpen(false);
    } catch (error) {
      const matched = applyFieldErrors(setError, error, FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
    }
  }

  async function handleComplete(task: Task) {
    setActionError(null);
    try {
      await completeTask(task.id);
      await invalidate();
    } catch (error) {
      setActionError(messageFrom(error));
    }
  }

  async function handleReopen(task: Task) {
    await reopenTask(task.id);
    await invalidate();
  }

  const tasks = query.data?.results ?? [];
  const open_ = tasks.filter((t) => t.status === "open");
  const done = tasks.filter((t) => t.status === "done");

  function taskLink(task: Task): string | null {
    if (task.type === "invoice_approval" && task.related_entity_id) return `/invoices/${task.related_entity_id}`;
    if (task.type === "privacy_request" && task.related_entity_id) return `/privacy/${task.related_entity_id}`;
    return null;
  }

  function TaskRow({ task }: { task: Task }) {
    const mirrored = MIRRORED_TASK_TYPES.includes(task.type as TaskType);
    const link = taskLink(task);
    return (
      <li className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="font-body text-sm font-medium text-cadence-ink">{task.title}</p>
          <p className="font-body text-xs text-cadence-ink/60">
            {TASK_TYPE_LABELS[task.type as TaskType]}
            {task.due_date ? ` · Due ${task.due_date}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={task.status === "done" ? "positive" : "neutral"}>
            {TASK_STATUS_LABELS[task.status as TaskStatus]}
          </Badge>
          {task.status === "open" ? (
            mirrored && link ? (
              <a href={link} className="font-body text-sm text-cadence-red underline">
                Go answer it
              </a>
            ) : !mirrored ? (
              <Button size="sm" onClick={() => handleComplete(task)}>
                Complete
              </Button>
            ) : null
          ) : (
            <Button size="sm" variant="secondary" onClick={() => handleReopen(task)}>
              Reopen
            </Button>
          )}
        </div>
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl text-cadence-ink">Tasks</h1>
        <Button onClick={() => setOpen(true)}>New task</Button>
      </div>
      {actionError ? <p className="font-body text-sm text-cadence-red">{actionError}</p> : null}

      {query.isLoading ? (
        <p className="font-body text-sm text-cadence-ink/60">Loading…</p>
      ) : query.isError ? (
        <p className="font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="font-subheading text-lg text-cadence-ink">Open</h2>
            {open_.length > 0 ? (
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                {open_.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </ul>
            ) : (
              <p className="font-body text-sm text-cadence-ink/60">No open tasks.</p>
            )}
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="font-subheading text-lg text-cadence-ink">Done</h2>
            {done.length > 0 ? (
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                {done.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </ul>
            ) : (
              <p className="font-body text-sm text-cadence-ink/60">No completed tasks.</p>
            )}
          </section>
        </>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="New task">
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <Field label="Title" htmlFor="task-title" error={errors.title?.message}>
            <Input id="task-title" {...register("title")} />
          </Field>
          <Field label="Due date" htmlFor="task-due" error={errors.due_date?.message}>
            <Input id="task-due" type="date" {...register("due_date")} />
          </Field>
          {formError ? <p className="font-body text-sm text-cadence-red">{formError}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
