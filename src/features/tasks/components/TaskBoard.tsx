"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { listUsers, userKeys } from "@/features/accounts/api";
import type { StaffUser } from "@/features/accounts/types";
import { listClients, getClient, listClientContacts } from "@/features/clients/api";
import { jobKeys, listJobs } from "@/features/jobs/api";
import type { Job } from "@/features/jobs/types";
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
import type { Task, TaskWrite } from "@/features/tasks/types";
import { getWorker, listWorkers, workerKeys } from "@/features/workers/api";
import { useOrgTimeZone } from "@/auth/use-org-timezone";
import { cn } from "@/shared/lib/cn";
import { formatDateTime } from "@/shared/lib/datetime";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import {
  JOB_STATUS_LABELS,
  MIRRORED_TASK_TYPES,
  TASK_TYPE_LABELS,
  type JobStatus,
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
  Select,
  Tabs,
  Tooltip,
} from "@/shared/ui";

const CREATABLE_CATEGORIES = [
  { value: "custom", label: "Custom" },
  { value: "job", label: "Job" },
  { value: "client_followup", label: "Client follow-up" },
  { value: "employee_followup", label: "Employee follow-up" },
] as const;

type CreatableCategory = (typeof CREATABLE_CATEGORIES)[number]["value"];

const taskSchema = z.object({
  title: z.string().min(1, "Title is required."),
  category: z.enum(["custom", "job", "client_followup", "employee_followup"]),
  due_date: z.string().optional().or(z.literal("")),
  related_entity_id: z.string().optional().or(z.literal("")),
});
type TaskFormValues = z.infer<typeof taskSchema>;
const FIELD_NAMES = ["title", "due_date", "related_entity_id"] as const;

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

function entityTypeForCategory(
  category: CreatableCategory,
): TaskWrite["related_entity_type"] | null {
  if (category === "job") return "job";
  if (category === "client_followup") return "client";
  if (category === "employee_followup") return "employee";
  return null;
}

function taskLink(task: Task): string | null {
  if (!task.related_entity_id) return null;
  if (task.type === "invoice_approval") return `/invoices/${task.related_entity_id}`;
  if (task.type === "privacy_request") return `/privacy/${task.related_entity_id}`;
  if (task.type === "client_notice_approval") return `/assignments/${task.related_entity_id}`;
  if (task.type === "job") return `/jobs/${task.related_entity_id}`;
  if (task.type === "client_followup") return `/clients/${task.related_entity_id}`;
  if (task.type === "employee_followup") return `/workers/${task.related_entity_id}`;
  return null;
}

function startLabel(task: Task): string {
  switch (task.type) {
    case "invoice_approval":
      return "Open invoice";
    case "privacy_request":
      return "Open request";
    case "client_notice_approval":
      return "Open assignment";
    case "client_followup":
      return "Call client";
    case "employee_followup":
      return "Open worker";
    case "job":
      return "Open job";
    default:
      return "Start";
  }
}

function isFollowUpType(type: string | undefined): boolean {
  return type === "client_followup" || type === "employee_followup";
}

function typeForTab(tab: BoardTab): string | undefined {
  if (tab === "todo") return undefined;
  return tab;
}

function normalizeUsers(data: StaffUser[] | { results: StaffUser[] } | undefined): StaffUser[] {
  if (!data) return [];
  return Array.isArray(data) ? data : data.results;
}

export function TaskBoard() {
  const queryClient = useQueryClient();
  const timeZone = useOrgTimeZone();
  const [tab, setTab] = useState<BoardTab>("todo");
  const [jobStatus, setJobStatus] = useState<JobStatus | "">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [followUpOffer, setFollowUpOffer] = useState<Task | null>(null);

  const listParams = { pageSize: 200, status: "open", type: typeForTab(tab) };
  const tasksQuery = useQuery({
    queryKey: taskKeys.list(listParams),
    queryFn: () => listTasks(listParams),
    enabled: tab !== "job",
  });
  const jobsQuery = useQuery({
    queryKey: jobKeys.list({ pageSize: 200, status: jobStatus || undefined }),
    queryFn: () => listJobs({ pageSize: 200, status: jobStatus || undefined }),
    enabled: tab === "job",
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
  const usersQuery = useQuery({
    queryKey: userKeys.list({ pageSize: 200 }),
    queryFn: () => listUsers({ pageSize: 200 }),
  });
  const users = normalizeUsers(usersQuery.data);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      category: "custom",
      due_date: "",
      related_entity_id: "",
    },
  });

  const category = watch("category");
  const needsRelated = entityTypeForCategory(category) != null;

  const clientsPickerQuery = useQuery({
    queryKey: ["clients-picker", "task-form"],
    queryFn: () => listClients({ pageSize: 200 }),
    enabled: formOpen && category === "client_followup",
  });
  const workersPickerQuery = useQuery({
    queryKey: workerKeys.list({ pageSize: 200 }),
    queryFn: () => listWorkers({ page: 1, pageSize: 200 }),
    enabled: formOpen && category === "employee_followup",
  });
  const jobsPickerQuery = useQuery({
    queryKey: jobKeys.list({ pageSize: 200, picker: true }),
    queryFn: () => listJobs({ pageSize: 200 }),
    enabled: formOpen && category === "job",
  });

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const tasks = (tasksQuery.data?.results ?? []).filter((t) => t.status === "open");
  const jobs = jobsQuery.data?.results ?? [];
  const clock = orgClockParts(now, timeZone);
  const fill = reportsQuery.data?.fill_rate;

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: taskKeys.all });
  }

  function openCreate(prefill?: Partial<TaskFormValues>) {
    setEditingTask(null);
    setFormError(null);
    reset({
      title: prefill?.title ?? "",
      category: prefill?.category ?? "custom",
      due_date: prefill?.due_date ?? "",
      related_entity_id: prefill?.related_entity_id ?? "",
    });
    setFormOpen(true);
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    setFormError(null);
    const cat = (CREATABLE_CATEGORIES.some((c) => c.value === task.type)
      ? task.type
      : "custom") as CreatableCategory;
    reset({
      title: task.title,
      category: cat,
      due_date: task.due_date ?? "",
      related_entity_id: task.related_entity_id ?? "",
    });
    setFormOpen(true);
  }

  function openFollowUpFrom(task: Task) {
    const category: CreatableCategory =
      task.type === "employee_followup" ? "employee_followup" : "client_followup";
    openCreate({
      title: task.title,
      category,
      related_entity_id: task.related_entity_id ?? "",
      due_date: "",
    });
    setFollowUpOffer(null);
  }

  async function submit(values: TaskFormValues) {
    setFormError(null);
    try {
      const due = values.due_date ? values.due_date.slice(0, 10) : null;
      if (editingTask) {
        await updateTask(editingTask.id, { title: values.title, due_date: due });
      } else {
        const entityType = entityTypeForCategory(values.category);
        const relatedId = values.related_entity_id?.trim() || "";
        const body: TaskWrite = {
          title: values.title,
          due_date: due,
        };
        if (entityType && relatedId) {
          body.related_entity_type = entityType;
          body.related_entity_id = relatedId;
        }
        await createTask(body);
      }
      await invalidate();
      setFormOpen(false);
      setEditingTask(null);
      reset();
    } catch (error) {
      const banner = applyFieldErrors(setError, error, [...FIELD_NAMES]);
      if (banner) setFormError(banner);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden sm:gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] lg:items-stretch lg:gap-8">
      <section className="shrink-0 pt-1 sm:pt-2">
        <p className="font-heading text-[2.75rem] leading-none text-cadence-ink sm:text-5xl lg:text-6xl">
          {clock.hour12}:{clock.minutes}
          <span className="ml-1 align-top font-fine text-xs text-cadence-ink/60 sm:text-sm">
            {clock.meridiem}
          </span>
        </p>
        <p className="mt-1.5 font-body text-sm text-cadence-ink/65">{clock.dateLabel}</p>

        {fill ? (
          <div className="mt-8">
            <p className="font-subheading text-[10px] uppercase tracking-[0.18em] text-cadence-ink/60">
              Overview
            </p>
            <div className="mt-3 flex flex-wrap gap-6">
              <div>
                <span aria-hidden className="mb-1.5 block h-1 w-6 rounded-full bg-cadence-orange" />
                <p className="font-heading text-4xl text-cadence-ink sm:text-5xl">
                  {pad(Math.min(99, clientsQuery.data?.count ?? 0))}
                </p>
                <p className="mt-1 font-fine text-[10px] uppercase tracking-wide text-cadence-ink/60">
                  Clients
                </p>
              </div>
              <div>
                <span aria-hidden className="mb-1.5 block h-1 w-6 rounded-full bg-cadence-lime" />
                <p className="font-heading text-4xl text-cadence-ink sm:text-5xl">
                  {pad(Math.min(99, workersQuery.data?.count ?? 0))}
                </p>
                <p className="mt-1 font-fine text-[10px] uppercase tracking-wide text-cadence-ink/60">
                  Employees
                </p>
              </div>
              <div>
                <span aria-hidden className="mb-1.5 block h-1 w-6 rounded-full bg-cadence-ink/35" />
                <p className="font-heading text-4xl text-cadence-ink sm:text-5xl">
                  {fill.headcount_filled ?? "—"}
                </p>
                <p className="mt-1 font-fine text-[10px] uppercase tracking-wide text-cadence-ink/60">
                  Jobs filled
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-8 flex flex-wrap gap-8">
            <div>
              <span aria-hidden className="mb-1.5 block h-1 w-6 rounded-full bg-cadence-orange" />
              <p className="font-heading text-4xl text-cadence-ink sm:text-5xl">
                {pad(Math.min(99, clientsQuery.data?.count ?? 0))}
              </p>
              <p className="mt-1 font-fine text-[10px] uppercase tracking-wide text-cadence-ink/60">
                Clients
              </p>
            </div>
            <div>
              <span aria-hidden className="mb-1.5 block h-1 w-6 rounded-full bg-cadence-lime" />
              <p className="font-heading text-4xl text-cadence-ink sm:text-5xl">
                {pad(Math.min(99, workersQuery.data?.count ?? 0))}
              </p>
              <p className="mt-1 font-fine text-[10px] uppercase tracking-wide text-cadence-ink/60">
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
            users={users}
            onClose={() => setSelectedId(null)}
            onEdit={() => openEdit(detailQuery.data)}
            onLogFollowUp={() => openFollowUpFrom(detailQuery.data)}
            onMutate={async () => {
              await invalidate();
              await queryClient.invalidateQueries({ queryKey: taskKeys.detail(selectedId) });
            }}
            onCompletedFollowUp={(task) => {
              setFollowUpOffer(task);
              setSelectedId(null);
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

            {tab === "job" ? (
              <>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(["", "open", "filled", "cancelled", "completed"] as const).map((s) => (
                    <button
                      key={s || "all"}
                      type="button"
                      onClick={() => setJobStatus(s)}
                      className={cn(
                        "rounded-full px-3 py-1 font-fine text-[10px] uppercase tracking-wide transition-colors",
                        jobStatus === s
                          ? "bg-cadence-yellow text-cadence-ink"
                          : "bg-white/10 text-on-card-muted hover:bg-white/15",
                      )}
                    >
                      {s ? JOB_STATUS_LABELS[s] : "All"}
                    </button>
                  ))}
                </div>
                {jobsQuery.isLoading ? (
                  <p className="mt-6 font-body text-sm text-on-card-muted">Loading…</p>
                ) : jobsQuery.isError ? (
                  <p className="mt-6 font-body text-sm text-cadence-red">
                    {messageFrom(jobsQuery.error)}
                  </p>
                ) : jobs.length === 0 ? (
                  <p className="py-10 text-center font-body text-sm text-on-card-muted">
                    No jobs.
                  </p>
                ) : (
                  <ul className="mt-4 min-h-0 flex-1 overflow-y-auto">
                    {jobs.map((job) => (
                      <JobCard key={job.id} job={job} timeZone={timeZone} />
                    ))}
                  </ul>
                )}
                <PermGate anyOf={PERM.JOBS_CREATE}>
                  <Link href="/jobs/new" className="absolute bottom-4 right-4">
                    <Fab label="New job" />
                  </Link>
                </PermGate>
              </>
            ) : (
              <>
                {tasksQuery.isLoading ? (
                  <p className="mt-6 font-body text-sm text-on-card-muted">Loading…</p>
                ) : tasksQuery.isError ? (
                  <p className="mt-6 font-body text-sm text-cadence-red">
                    {messageFrom(tasksQuery.error)}
                  </p>
                ) : tasks.length === 0 ? (
                  <p className="py-10 text-center font-body text-sm text-on-card-muted">
                    No open tasks.
                  </p>
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
                            if (isFollowUpType(task.type)) setFollowUpOffer(task);
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
                    onClick={() => openCreate()}
                  />
                </PermGate>
              </>
            )}
          </>
        )}
      </section>

      <Dialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingTask(null);
        }}
        title={editingTask ? "Edit task" : "New task"}
      >
        <p className="mb-4 font-body text-sm text-on-card-muted">
          {editingTask
            ? "Update the title or due date."
            : "Add an item to your to-do list. Manual creates are always custom; category links an optional related record."}
        </p>
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <Field label="Task title" htmlFor="task-title" error={errors.title?.message}>
            <Input id="task-title" {...register("title")} />
          </Field>
          <Field label="Category" htmlFor="task-category" error={errors.category?.message}>
            <Select
              id="task-category"
              {...register("category")}
              disabled={Boolean(editingTask)}
            >
              {CREATABLE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due date" htmlFor="task-due" error={errors.due_date?.message}>
            <Input id="task-due" type="date" {...register("due_date")} />
          </Field>
          {!editingTask && needsRelated ? (
            <Field
              label={
                category === "job"
                  ? "Related job"
                  : category === "client_followup"
                    ? "Related client"
                    : "Related worker"
              }
              htmlFor="task-related"
              error={errors.related_entity_id?.message}
              hint="Optional — links the task to a record."
            >
              <Select id="task-related" {...register("related_entity_id")}>
                <option value="">None</option>
                {category === "client_followup"
                  ? (clientsPickerQuery.data?.results ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))
                  : null}
                {category === "employee_followup"
                  ? (workersPickerQuery.data?.results ?? []).map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.first_name} {w.last_name}
                      </option>
                    ))
                  : null}
                {category === "job"
                  ? (jobsPickerQuery.data?.results ?? []).map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title} · {j.client_name}
                      </option>
                    ))
                  : null}
              </Select>
            </Field>
          ) : null}
          {formError ? <p className="font-body text-sm text-cadence-red">{formError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setFormOpen(false);
                setEditingTask(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? editingTask
                  ? "Saving…"
                  : "Adding…"
                : editingTask
                  ? "Save"
                  : "Add task"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(followUpOffer)}
        onClose={() => setFollowUpOffer(null)}
        title="Log another follow-up?"
      >
        <p className="mb-4 font-body text-sm text-on-card-muted">
          Create a new follow-up for the same{" "}
          {followUpOffer?.type === "employee_followup" ? "worker" : "client"}.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setFollowUpOffer(null)}>
            Not now
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (followUpOffer) openFollowUpFrom(followUpOffer);
            }}
          >
            Log another follow-up
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function JobCard({ job, timeZone }: { job: Job; timeZone: string | undefined }) {
  const start = timeZone ? formatDateTime(job.start_datetime, timeZone) : "—";
  const initial = (job.title?.trim()?.[0] ?? "J").toUpperCase();
  return (
    <li className="flex items-start justify-between gap-3 rounded-2xl px-2 py-2.5 hover:bg-white/5">
      <div className="flex min-w-0 flex-1 gap-3">
        <span
          aria-hidden
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cadence-yellow/90 font-fine text-xs font-medium text-cadence-ink"
        >
          {initial}
        </span>
        <div className="min-w-0">
          <p className="font-body text-sm leading-snug text-on-card">{job.title}</p>
          <p className="font-fine text-[10px] text-on-card-muted">{job.client_name}</p>
          <p className="font-fine text-[10px] text-on-card-muted">
            {job.headcount_needed ?? "—"} needed · {start}
          </p>
        </div>
      </div>
      <Link
        href={`/jobs/${job.id}`}
        className="shrink-0 rounded-full bg-cadence-yellow px-3 py-1.5 font-fine text-[10px] uppercase tracking-wide text-cadence-ink"
      >
        Start
      </Link>
    </li>
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
  const label = startLabel(task);
  const followUp = isFollowUpType(task.type);
  const jobLink = task.type === "job" && task.related_entity_id;

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
        {followUp ? (
          <Tooltip content="Open follow-up detail">
            <button
              type="button"
              onClick={onOpen}
              className="rounded-full bg-cadence-yellow px-3 py-1.5 font-fine text-[10px] uppercase tracking-wide text-cadence-ink"
            >
              {label}
            </button>
          </Tooltip>
        ) : mirrored && link ? (
          <Tooltip content="Open the record this task is about">
            <Link
              href={link}
              className="rounded-full bg-cadence-yellow px-3 py-1.5 font-fine text-[10px] uppercase tracking-wide text-cadence-ink"
            >
              {label}
            </Link>
          </Tooltip>
        ) : jobLink ? (
          <Tooltip content="Open job">
            <Link
              href={`/jobs/${task.related_entity_id}`}
              className="rounded-full bg-cadence-yellow px-3 py-1.5 font-fine text-[10px] uppercase tracking-wide text-cadence-ink"
            >
              {label}
            </Link>
          </Tooltip>
        ) : !mirrored ? (
          <Tooltip content="Mark this task complete">
            <button
              type="button"
              onClick={onComplete}
              className="rounded-full bg-cadence-yellow px-3 py-1.5 font-fine text-[10px] uppercase tracking-wide text-cadence-ink"
            >
              {label}
            </button>
          </Tooltip>
        ) : null}
      </div>
    </li>
  );
}

function TaskDetailPanel({
  task,
  users,
  onClose,
  onEdit,
  onLogFollowUp,
  onMutate,
  onCompletedFollowUp,
  setActionError,
}: {
  task: Task;
  users: StaffUser[];
  onClose: () => void;
  onEdit: () => void;
  onLogFollowUp: () => void;
  onMutate: () => Promise<void>;
  onCompletedFollowUp: (task: Task) => void;
  setActionError: (msg: string | null) => void;
}) {
  const timeZone = useOrgTimeZone();
  const mirrored = MIRRORED_TASK_TYPES.includes(task.type as TaskType);
  const link = taskLink(task);
  const [assignee, setAssignee] = useState(task.assignee_id ?? "");
  const assigneeLabel =
    users.find((u) => u.id === task.assignee_id)?.login_masked ?? task.assignee_id ?? "Unassigned";

  useEffect(() => {
    setAssignee(task.assignee_id ?? "");
  }, [task.assignee_id, task.id]);

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
          <dt className="font-fine text-[10px] uppercase tracking-wide text-on-card-muted">
            Category
          </dt>
          <dd>{TASK_TYPE_LABELS[task.type as TaskType] ?? task.type}</dd>
        </div>
        <div>
          <dt className="font-fine text-[10px] uppercase tracking-wide text-on-card-muted">
            Created
          </dt>
          <dd>{timeZone ? formatDateTime(task.created_at, timeZone) : "—"}</dd>
        </div>
        <div>
          <dt className="font-fine text-[10px] uppercase tracking-wide text-on-card-muted">
            Assigned to
          </dt>
          <dd>{assigneeLabel}</dd>
        </div>
      </dl>

      <FollowUpEntityBlock task={task} />

      <PermGate anyOf={PERM.TASKS_ASSIGN}>
        <div className="mt-4 flex gap-2">
          <Select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="!bg-card-muted !text-on-card"
            aria-label="Assignee"
          >
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.login_masked ?? u.id}
              </option>
            ))}
          </Select>
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
            <Button>{startLabel(task)}</Button>
          </Link>
        ) : null}
        {isFollowUpType(task.type) && link ? (
          <Link href={link}>
            <Button variant="secondary">
              {task.type === "client_followup" ? "Open client" : "Open worker"}
            </Button>
          </Link>
        ) : null}
        {isFollowUpType(task.type) ? (
          <PermGate anyOf={PERM.TASKS_CREATE}>
            <Button variant="secondary" onClick={onLogFollowUp}>
              Log another follow-up
            </Button>
          </PermGate>
        ) : null}
        {task.status === "open" && !mirrored ? (
          <PermGate anyOf={PERM.TASKS_COMPLETE}>
            <Button
              onClick={async () => {
                setActionError(null);
                try {
                  await completeTask(task.id);
                  await onMutate();
                  if (isFollowUpType(task.type)) {
                    onCompletedFollowUp(task);
                  } else {
                    onClose();
                  }
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
          <Button variant="secondary" onClick={onEdit}>
            Edit
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
