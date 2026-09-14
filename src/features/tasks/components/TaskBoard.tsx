"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { listClients, clientKeys } from "@/features/clients/api";
import { completeTask, createTask, reopenTask } from "@/features/tasks/actions";
import { listTasks, taskKeys } from "@/features/tasks/api";
import type { Task } from "@/features/tasks/types";
import { listWorkers, workerKeys } from "@/features/workers/api";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import {
  MIRRORED_TASK_TYPES,
  TASK_TYPE_LABELS,
  type TaskType,
} from "@/shared/lib/status-labels";
import { PERM } from "@/permissions/keys";
import { Button, Dialog, Field, Input, PermGate, Tooltip } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";

const taskSchema = z.object({
  title: z.string().min(1, "Title is required."),
  due_date: z.string().optional().or(z.literal("")),
});
type TaskFormValues = z.infer<typeof taskSchema>;
const FIELD_NAMES = Object.keys(taskSchema.shape);

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function TaskBoard() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: taskKeys.list(), queryFn: () => listTasks({ pageSize: 200 }) });
  const workersQuery = useQuery({
    queryKey: workerKeys.list({ page: 1 }),
    queryFn: () => listWorkers({ page: 1, pageSize: 1 }),
    retry: false,
  });
  const clientsQuery = useQuery({
    queryKey: clientKeys.list({ page: 1 }),
    queryFn: () => listClients({ page: 1, pageSize: 1 }),
    retry: false,
  });

  const [now, setNow] = useState(() => new Date());
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

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const tasks = query.data?.results ?? [];
  const openTasks = tasks.filter((t) => t.status === "open");
  const doneTasks = tasks.filter((t) => t.status === "done");

  const hours = now.getHours();
  const minutes = pad(now.getMinutes());
  const hour12 = hours % 12 || 12;
  const meridiem = hours >= 12 ? "pm" : "am";
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

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

  function taskLink(task: Task): string | null {
    if (task.type === "invoice_approval" && task.related_entity_id) return `/invoices/${task.related_entity_id}`;
    if (task.type === "privacy_request" && task.related_entity_id) return `/privacy/${task.related_entity_id}`;
    return null;
  }

  const grouped = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayItems = openTasks.filter((t) => t.due_date === today || !t.due_date);
    const later = openTasks.filter((t) => t.due_date && t.due_date > today);
    return { todayItems, later };
  }, [openTasks]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:items-stretch lg:gap-8">
      <section className="shrink-0 pt-1 sm:pt-2">
        <p className="font-heading text-[2.75rem] leading-none text-cadence-ink sm:text-5xl lg:text-6xl">
          {pad(hour12)}:{minutes}
          <span className="ml-1 align-top font-fine text-xs text-cadence-ink/45 sm:text-sm">{meridiem}</span>
        </p>
        <p className="mt-1.5 font-body text-sm text-cadence-ink/50">{dateLabel}</p>

        <div className="mt-6 grid grid-cols-3 gap-3 sm:mt-10 sm:flex sm:flex-wrap sm:items-end sm:gap-8">
          <div>
            <p className="font-heading text-4xl leading-none text-cadence-orange sm:text-6xl">
              {pad(openTasks.length)}
            </p>
            <p className="mt-1 font-fine text-[10px] uppercase tracking-wide text-cadence-ink/40">Open</p>
          </div>
          <div>
            <p className="font-heading text-4xl leading-none text-cadence-lime sm:text-6xl">
              {pad(Math.min(99, workersQuery.data?.count ?? 0))}
            </p>
            <p className="mt-1 font-fine text-[10px] uppercase tracking-wide text-cadence-ink/40">Workers</p>
          </div>
          <div>
            <p className="font-heading text-4xl leading-none text-cadence-ink/70 sm:text-6xl">
              {pad(Math.min(99, clientsQuery.data?.count ?? 0))}
            </p>
            <p className="mt-1 font-fine text-[10px] uppercase tracking-wide text-cadence-ink/40">Clients</p>
          </div>
        </div>

        <div className="mt-5 flex gap-6 font-fine text-xs text-cadence-ink/55 sm:mt-8 sm:gap-8">
          <span>{doneTasks.length} done</span>
          <span>{tasks.length} total</span>
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.5rem] bg-card p-4 text-on-card shadow-card sm:rounded-[2rem] sm:p-5 lg:min-h-[28rem]">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-subheading text-xs uppercase tracking-[0.18em] text-cadence-yellow">Today</p>
          <PermGate anyOf={PERM.TASKS_CREATE}>
            <Button size="sm" tooltip="Create a follow-up for this office" onClick={() => setOpen(true)}>
              Add
            </Button>
          </PermGate>
        </div>
        {actionError ? <p className="mb-3 font-body text-xs text-cadence-red">{actionError}</p> : null}
        {query.isLoading ? (
          <p className="font-body text-sm text-on-card-muted">Loading…</p>
        ) : query.isError ? (
          <p className="font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>
        ) : openTasks.length === 0 ? (
          <p className="py-10 text-center font-body text-sm text-on-card-muted">No open tasks.</p>
        ) : (
          <ul className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {grouped.todayItems.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                link={taskLink(task)}
                onComplete={async () => {
                  setActionError(null);
                  try {
                    await completeTask(task.id);
                    await invalidate();
                  } catch (error) {
                    setActionError(messageFrom(error));
                  }
                }}
                onReopen={async () => {
                  await reopenTask(task.id);
                  await invalidate();
                }}
              />
            ))}
            {grouped.later.length > 0 ? (
              <>
                <li className="mt-3 px-1 font-subheading text-[10px] uppercase tracking-[0.18em] text-on-card-muted">
                  Later
                </li>
                {grouped.later.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    link={taskLink(task)}
                    onComplete={async () => {
                      setActionError(null);
                      try {
                        await completeTask(task.id);
                        await invalidate();
                      } catch (error) {
                        setActionError(messageFrom(error));
                      }
                    }}
                    onReopen={async () => {
                      await reopenTask(task.id);
                      await invalidate();
                    }}
                  />
                ))}
              </>
            ) : null}
          </ul>
        )}
      </section>

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

function TaskRow({
  task,
  link,
  onComplete,
  onReopen,
}: {
  task: Task;
  link: string | null;
  onComplete: () => void;
  onReopen: () => void;
}) {
  const mirrored = MIRRORED_TASK_TYPES.includes(task.type as TaskType);
  return (
    <li className="flex items-start justify-between gap-3 rounded-2xl px-2 py-2.5 hover:bg-white/5">
      <div className="min-w-0 flex-1">
        <p className="font-body text-sm leading-snug text-on-card">{task.title}</p>
        <p className="font-fine text-[10px] text-on-card-muted">
          {TASK_TYPE_LABELS[task.type as TaskType]}
          {task.due_date ? ` · ${task.due_date}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {task.status === "open" ? (
          mirrored && link ? (
            <Tooltip content="Open the record this task is about">
              <a href={link} className="font-fine text-[10px] uppercase tracking-wide text-cadence-yellow">
                Open
              </a>
            </Tooltip>
          ) : !mirrored ? (
            <Tooltip content="Mark this task complete">
              <button
                type="button"
                onClick={onComplete}
                className="h-7 rounded-full bg-cadence-yellow px-3 font-fine text-[10px] uppercase tracking-wide text-cadence-ink"
              >
                Done
              </button>
            </Tooltip>
          ) : null
        ) : (
          <Tooltip content="Move this task back to open">
            <button
              type="button"
              onClick={onReopen}
              className={cn("font-fine text-[10px] uppercase tracking-wide text-on-card-muted")}
            >
              Reopen
            </button>
          </Tooltip>
        )}
      </div>
    </li>
  );
}
