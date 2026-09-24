"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useOrgTimeZone } from "@/auth/use-org-timezone";
import { getTask, taskKeys } from "@/features/tasks/api";
import { formatDateTime } from "@/shared/lib/datetime";
import { isNotFound, messageFrom } from "@/shared/lib/errors";
import { TASK_TYPE_LABELS, type TaskType } from "@/shared/lib/status-labels";
import { PageHeader, PageFrame, PageScrollRegion } from "@/shared/ui";

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const timeZone = useOrgTimeZone();
  const query = useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: () => getTask(id),
    retry: false,
  });
  if (query.isError && isNotFound(query.error)) notFound();
  if (query.isLoading) return <p className="text-sm text-cadence-ink/60">Loading…</p>;
  if (query.isError) return <p className="text-sm text-cadence-red">{messageFrom(query.error)}</p>;
  const task = query.data;
  if (!task) return null;

  return (
    <PageFrame>
      <PageScrollRegion className="flex flex-col gap-4">
      <PageHeader title={task.title} />
      <p className="text-sm text-cadence-ink/60">
        {task.status} · {TASK_TYPE_LABELS[task.type as TaskType] ?? task.type}
        {task.due_date ? ` · due ${task.due_date}` : ""}
      </p>
      <p className="text-sm">
        <Link href="/" className="underline">
          Open on dashboard
        </Link>
      </p>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-cadence-ink/60">Created</dt>
          <dd>{timeZone ? formatDateTime(task.created_at, timeZone) : "—"}</dd>
        </div>
        <div>
          <dt className="text-cadence-ink/60">Assignee</dt>
          <dd>{task.assignee_id ?? "Unassigned"}</dd>
        </div>
        <div>
          <dt className="text-cadence-ink/60">Related</dt>
          <dd>
            {task.related_entity_type ?? "—"} {task.related_entity_id ?? ""}
          </dd>
        </div>
      </dl>
    </PageScrollRegion>
    </PageFrame>
  );
}
