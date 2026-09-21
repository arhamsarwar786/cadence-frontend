"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { listClients, getClient, listClientContacts } from "@/features/clients/api";
import { getReportsDashboard, reportKeys } from "@/features/money/api";
import {
  assignTask,
  completeTask,
  createTask,
  deleteTask,
  reopenTask,
  updateTask,
} from "@/features/tasks/actions";
import { getTask, listTasks, taskKeys } from "@/features/tasks/api";
import type { Task } from "@/features/tasks/types";
import { getWorker, listWorkers, workerKeys } from "@/features/workers/api";
import { useOrgTimeZone } from "@/auth/use-org-timezone";
import { formatDateTime } from "@/shared/lib/datetime";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import {
  MIRRORED_TASK_TYPES,
  TASK_TYPE_LABELS,
  type TaskType,
} from "@/shared/lib/status-labels";
import { PERM } from "@/permissions/keys";
import {
  Button,
  Dialog,
  Fab,
  Field,
  Input,
  PermGate,
  Tabs,
  Tooltip,
} from "@/shared/ui";

const taskSchema = z.object({
  title: z.string().min(1, "Title is required."),
  due_date: z.string().optional().or(z.literal("")),
});
type TaskFormValues = z.infer<typeof taskSchema>;
const FIELD_NAMES = Object.keys(taskSchema.shape);

type BoardTab = "todo" | "job" | "client_followup" | "employee_followup";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function orgClockParts(now: Date, timeZone: string | undefined) {
  if (!timeZone) {
    return { dateLabel: "—", hour12: "—", minutes: "--", meridiem: "" };
  }
  const dateLabel = new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone,
  }).format(now);
  const parts = new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).formatToParts(now);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "—";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "--";
  const dayPeriod = (parts.find((p) => p.type === "dayPeriod")?.value ?? "").toLowerCase();
  return { dateLabel, hour12: hour, minutes: minute.padStart(2, "0"), meridiem: dayPeriod };
}

function taskLink(task: Task): string | null {
  if (task.type === "invoice_approval" && task.related_entity_id) {
    return `/invoices/${task.related_entity_id}`;
  }
  if (task.type === "privacy_request" && task.related_entity_id) {
    return `/privacy/${task.related_entity_id}`;
  }
  if (task.type === "client_notice_approval" && task.related_entity_id) {
    return `/assignments/${task.related_entity_id}`;
  }
  return null;
}

function typeForTab(tab: BoardTab): string | undefined {
  if (tab === "todo") return undefined;
  return tab;
}

export function TaskBoard() {
  const queryClient = useQueryClient();
  const timeZone = useOrgTimeZone();
  const [tab, setTab] = useState<BoardTab>("todo");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const listParams = { pageSize: 200, status: "open", type: typeForTab(tab) };
  const query = useQuery({
    queryKey: taskKeys.list(listParams),
    queryFn: () => listTasks(listParams),
  });
  const detailQuery = useQuery({
    queryKey: taskKeys.detail(selectedId ?? ""),
    queryFn: () => getTask(selectedId!),
    enabled: Boolean(selectedId),
  });
  const workersQuery = useQuery({
    queryKey: workerKeys.list({ page: 1 }),
    queryFn: () => listWorkers({ page: 1, pageSize: 1 }),
    retry: false,
  });
  const clientsQuery = useQuery({
    queryKey: ["clients", { page: 1 }],
    queryFn: () => listClients({ page: 1, pageSize: 1 }),
    retry: false,
  });
  const reportsQuery = useQuery({
    queryKey: reportKeys.detail("dashboard"),
    queryFn: getReportsDashboard,
    retry: false,
  });

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

  const tasks = (query.data?.results ?? []).filter((t) => t.status === "open");
  const clock = orgClockParts(now, timeZone);
  const dateLabel = clock.dateLabel;
  const hour12 = clock.hour12;
  const minutes = clock.minutes;
  const meridiem = clock.meridiem;

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: taskKeys.all });
  }

  async function submit(values: TaskFormValues) {
    setFormError(null);
    try {
      const due = values.due_date ? values.due_date.slice(0, 10) : undefined;
      await createTask({ title: values.title, due_date: due || null });
      await invalidate();
      reset();
      setOpen(false);
    } catch (error) {
      const matched = applyFieldErrors(setError, error, FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
    }
  }

  const fill = reportsQuery.data?.fill_rate;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] lg:items-stretch lg:gap-8">
      <section className="shrink-0 pt-1 sm:pt-2">
        <p className="font-heading text-[2.75rem] leading-none text-cadence-ink sm:text-5xl lg:text-6xl">
          {hour12}:{minutes}
          <span className="ml-1 align-top font-fine text-xs text-cadence-ink/45 sm:text-sm">
            {meridiem}
          </span>
        </p>
        <p className="mt-1.5 font-body text-sm text-cadence-ink/50">{dateLabel}</p>

        {fill ? (
          <div className="mt-8">
            <p className="font-subheading text-[10px] uppercase tracking-[0.18em] text-cadence-ink/40">
              Overview
            </p>
            <div className="mt-3 flex flex-wrap gap-6">
              <div>
                <p className="font-heading text-4xl text-cadence-orange sm:text-5xl">
                  {pad(Math.min(99, clientsQuery.data?.count ?? 0))}
                </p>
                <p className="mt-1 font-fine text-[10px] uppercase tracking-wide text-cadence-ink/40">
                  Clients
                </p>
              </div>
              <div>
                <p className="font-heading text-4xl text-cadence-lime sm:text-5xl">
                  {pad(Math.min(99, workersQuery.data?.count ?? 0))}
                </p>
                <p className="mt-1 font-fine text-[10px] uppercase tracking-wide text-cadence-ink/40">
                  Employees
                </p>
              </div>
              <div>
                <p className="font-heading text-4xl text-cadence-ink/70 sm:text-5xl">
                  {fill.headcount_filled ?? "—"}
                </p>
                <p className="mt-1 font-fine text-[10px] uppercase tracking-wide text-cadence-ink/40">
                  Jobs filled
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-8 flex flex-wrap gap-8">
            <div>
              <p className="font-heading text-4xl text-cadence-orange sm:text-5xl">
                {pad(Math.min(99, clientsQuery.data?.count ?? 0))}
              </p>
              <p className="mt-1 font-fine text-[10px] uppercase tracking-wide text-cadence-ink/40">
                Clients
              </p>
            </div>
            <div>
              <p className="font-heading text-4xl text-cadence-lime sm:text-5xl">
                {pad(Math.min(99, workersQuery.data?.count ?? 0))}
              </p>
              <p className="mt-1 font-fine text-[10px] uppercase tracking-wide text-cadence-ink/40">
                Employees
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.5rem] bg-card p-4 text-on-card shadow-card sm:rounded-[2rem] sm:p-5 lg:min-h-[28rem]">
        {selectedId && detailQuery.data ? (
          <TaskDetailPanel
            task={detailQuery.data}
            onClose={() => setSelectedId(null)}
            onMutate={async () => {
              await invalidate();
              await queryClient.invalidateQueries({ queryKey: taskKeys.detail(selectedId) });
            }}
            setActionError={setActionError}
          />
        ) : (
          <>
            <Tabs
              dark
              value={tab}
              onChange={(id) => {
                setTab(id);
                setSelectedId(null);
              }}
              items={[
                { id: "todo", label: "To-do list" },
                { id: "job", label: "Jobs" },
                { id: "client_followup", label: "Clients" },
                { id: "employee_followup", label: "Employees" },
              ]}
            />
            {actionError ? (
              <p className="mt-3 font-body text-xs text-cadence-red">{actionError}</p>
            ) : null}
            {query.isLoading ? (
              <p className="mt-6 font-body text-sm text-on-card-muted">Loading…</p>
            ) : query.isError ? (
              <p className="mt-6 font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>
            ) : tasks.length === 0 ? (
              <p className="py-10 text-center font-body text-sm text-on-card-muted">No open tasks.</p>
            ) : (
              <ul className="mt-4 min-h-0 flex-1 overflow-y-auto">
                {tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onOpen={() => setSelectedId(task.id)}
                    onComplete={async () => {
                      setActionError(null);
                      try {
                        await completeTask(task.id);
                        await invalidate();
                      } catch (error) {
                        setActionError(messageFrom(error));
                      }
                    }}
                  />
                ))}
              </ul>
            )}
            <PermGate anyOf={PERM.TASKS_CREATE}>
              <Fab
                className="absolute bottom-4 right-4"
                label="Add task"
                onClick={() => setOpen(true)}
              />
            </PermGate>
          </>
        )}
      </section>

      <Dialog open={open} onClose={() => setOpen(false)} title="New task">
        <p className="mb-4 font-body text-sm text-cadence-ink/60">
          Add an item to your to-do list. New tasks are created as custom follow-ups.
        </p>
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <Field label="Task title" htmlFor="task-title" error={errors.title?.message}>
            <Input id="task-title" {...register("title")} />
          </Field>
          <Field label="Due date" htmlFor="task-due" error={errors.due_date?.message}>
            <Input id="task-due" type="datetime-local" {...register("due_date")} />
          </Field>
          {formError ? <p className="font-body text-sm text-cadence-red">{formError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding…" : "Add task"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function TaskRow({
  task,
  onOpen,
  onComplete,
}: {
  task: Task;
  onOpen: () => void;
  onComplete: () => void;
}) {
  const mirrored = MIRRORED_TASK_TYPES.includes(task.type as TaskType);
  const link = taskLink(task);
  return (
    <li className="flex items-start justify-between gap-3 rounded-2xl px-2 py-2.5 hover:bg-white/5">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className="font-body text-sm leading-snug text-on-card">{task.title}</p>
        <p className="font-fine text-[10px] text-on-card-muted">
          {TASK_TYPE_LABELS[task.type as TaskType] ?? task.type}
          {task.due_date ? ` · ${task.due_date}` : ""}
        </p>
      </button>
      <div className="flex shrink-0 items-center gap-2">
        {mirrored && link ? (
          <Tooltip content="Open the record this task is about">
            <Link
              href={link}
              className="rounded-full bg-cadence-yellow px-3 py-1.5 font-fine text-[10px] uppercase tracking-wide text-cadence-ink"
            >
              Start
            </Link>
          </Tooltip>
        ) : !mirrored ? (
          <Tooltip content="Mark this task complete">
            <button
              type="button"
              onClick={onComplete}
              className="rounded-full bg-cadence-yellow px-3 py-1.5 font-fine text-[10px] uppercase tracking-wide text-cadence-ink"
            >
              Start
            </button>
          </Tooltip>
        ) : null}
      </div>
    </li>
  );
}

function TaskDetailPanel({
  task,
  onClose,
  onMutate,
  setActionError,
}: {
  task: Task;
  onClose: () => void;
  onMutate: () => Promise<void>;
  setActionError: (msg: string | null) => void;
}) {
  const timeZone = useOrgTimeZone();
  const mirrored = MIRRORED_TASK_TYPES.includes(task.type as TaskType);
  const link = taskLink(task);
  const [assignee, setAssignee] = useState(task.assignee_id ?? "");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        onClick={onClose}
        className="mb-3 self-start font-fine text-[10px] uppercase tracking-wide text-on-card-muted"
      >
        ← Back
      </button>
      <h2 className="font-heading text-2xl text-on-card">{task.title}</h2>
      <p className="mt-1 font-body text-sm text-on-card-muted">
        {task.status === "open" ? "To-do" : "Done"}
        {task.due_date ? ` · due ${task.due_date}` : ""}
      </p>
      <dl className="mt-6 space-y-3 font-body text-sm">
        <div>
          <dt className="font-fine text-[10px] uppercase tracking-wide text-on-card-muted">Category</dt>
          <dd>{TASK_TYPE_LABELS[task.type as TaskType] ?? task.type}</dd>
        </div>
        <div>
          <dt className="font-fine text-[10px] uppercase tracking-wide text-on-card-muted">Created</dt>
          <dd>{timeZone ? formatDateTime(task.created_at, timeZone) : "—"}</dd>
        </div>
        <div>
          <dt className="font-fine text-[10px] uppercase tracking-wide text-on-card-muted">Assigned to</dt>
          <dd>{task.assignee_id ?? "Unassigned"}</dd>
        </div>
      </dl>

      <FollowUpEntityBlock task={task} />

      <PermGate anyOf={PERM.TASKS_ASSIGN}>
        <div className="mt-4 flex gap-2">
          <Input
            placeholder="Assignee user id"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="!bg-card-muted !text-on-card"
          />
          <Button
            size="sm"
            onClick={async () => {
              setActionError(null);
              try {
                await assignTask(task.id, { assignee: assignee || null });
                await onMutate();
              } catch (error) {
                setActionError(messageFrom(error));
              }
            }}
          >
            Assign
          </Button>
        </div>
      </PermGate>

      <div className="mt-auto flex flex-wrap gap-2 pt-8">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        {mirrored && link ? (
          <Link href={link}>
            <Button>Open record</Button>
          </Link>
        ) : null}
        {task.status === "open" && !mirrored ? (
          <PermGate anyOf={PERM.TASKS_COMPLETE}>
            <Button
              onClick={async () => {
                setActionError(null);
                try {
                  await completeTask(task.id);
                  await onMutate();
                  onClose();
                } catch (error) {
                  setActionError(messageFrom(error));
                }
              }}
            >
              Done
            </Button>
          </PermGate>
        ) : null}
        {task.status === "done" ? (
          <Button
            onClick={async () => {
              await reopenTask(task.id);
              await onMutate();
            }}
          >
            Reopen
          </Button>
        ) : null}
        <PermGate anyOf={PERM.TASKS_DELETE}>
          <Button
            variant="danger"
            onClick={async () => {
              await deleteTask(task.id);
              await onMutate();
              onClose();
            }}
          >
            Delete
          </Button>
        </PermGate>
        <PermGate anyOf={PERM.TASKS_EDIT}>
          <Button
            variant="secondary"
            onClick={async () => {
              const title = window.prompt("Edit title", task.title);
              if (!title) return;
              await updateTask(task.id, { title });
              await onMutate();
            }}
          >
            Edit title
          </Button>
        </PermGate>
      </div>
    </div>
  );
}

function FollowUpEntityBlock({ task }: { task: Task }) {
  const isClient = task.type === "client_followup" && task.related_entity_id;
  const isWorker = task.type === "employee_followup" && task.related_entity_id;

  const clientQuery = useQuery({
    queryKey: ["task-client", task.related_entity_id],
    queryFn: () => getClient(task.related_entity_id!),
    enabled: Boolean(isClient),
  });
  const contactsQuery = useQuery({
    queryKey: ["task-client-contacts", task.related_entity_id],
    queryFn: () => listClientContacts(task.related_entity_id!),
    enabled: Boolean(isClient),
  });
  const workerQuery = useQuery({
    queryKey: ["task-worker", task.related_entity_id],
    queryFn: () => getWorker(task.related_entity_id!),
    enabled: Boolean(isWorker),
  });

  if (isClient && clientQuery.data) {
    const primary =
      contactsQuery.data?.find((c) => c.is_primary) ?? contactsQuery.data?.[0];
    const c = clientQuery.data;
    return (
      <div className="mt-6 rounded-2xl bg-white/5 p-3 text-sm">
        <p className="font-fine text-[10px] uppercase tracking-wide text-on-card-muted">
          Client information
        </p>
        <p className="mt-2">
          <Link href={`/clients/${c.id}`} className="text-cadence-yellow underline">
            {c.name}
          </Link>
        </p>
        {primary ? (
          <p className="text-on-card-muted">
            {primary.name}
            {primary.phone ? ` · ${primary.phone}` : ""}
            {primary.email ? ` · ${primary.email}` : ""}
          </p>
        ) : null}
        <p className="text-on-card-muted">
          {[c.address_line_1, c.city, c.province].filter(Boolean).join(", ")}
        </p>
      </div>
    );
  }

  if (isWorker && workerQuery.data) {
    const w = workerQuery.data;
    return (
      <div className="mt-6 rounded-2xl bg-white/5 p-3 text-sm">
        <p className="font-fine text-[10px] uppercase tracking-wide text-on-card-muted">
          Employee information
        </p>
        <p className="mt-2">
          <Link href={`/workers/${w.id}`} className="text-cadence-yellow underline">
            {w.first_name} {w.last_name}
          </Link>
        </p>
        <p className="text-on-card-muted">
          {w.phone ?? "—"} · {w.email ?? "—"}
        </p>
        <p className="text-on-card-muted">
          {[w.address_line_1, w.city, w.province].filter(Boolean).join(", ") || "—"}
        </p>
        {"rating" in w && w.rating != null ? (
          <p className="mt-1">★ {w.rating}</p>
        ) : null}
      </div>
    );
  }

  return null;
}
