"use client";

import { Loading } from "@/shared/ui/Loading";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notFound, useParams } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/auth/session-context";
import { useOrgTimeZone } from "@/auth/use-org-timezone";
import { listUsersNormalized, userKeys } from "@/features/accounts/api";
import { reopenTask } from "@/features/tasks/actions";
import { getTask, taskKeys } from "@/features/tasks/api";
import { formatDateTime } from "@/shared/lib/datetime";
import { isNotFound, messageFrom } from "@/shared/lib/errors";
import { TASK_TYPE_LABELS, type TaskType } from "@/shared/lib/status-labels";
import { PERM } from "@/permissions/keys";
import { Button, PageHeader, PageFrame, PageScrollRegion, PermGate, QueryError, useHasPerm } from "@/shared/ui";

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const timeZone = useOrgTimeZone();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const canListUsers = useHasPerm(PERM.ADMIN_USERS_VIEW);
  const usersQuery = useQuery({
    queryKey: userKeys.list({ pageSize: 200 }),
    queryFn: () => listUsersNormalized({ pageSize: 200 }),
    enabled: canListUsers,
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: () => getTask(id),
    retry: false,
  });
  if (query.isError && isNotFound(query.error)) notFound();
  if (query.isLoading) return <Loading />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => query.refetch()} />;
  const task = query.data;
  if (!task) return null;

  const assigneeLabel = !task.assignee_id
    ? "Unassigned"
    : task.assignee_id === session?.user.id
      ? "You"
      : (usersQuery.data?.find((u) => u.id === task.assignee_id)?.login_masked ??
        `User ····${task.assignee_id.slice(-4)}`);

  return (
    <PageFrame>
      <PageHeader title={task.title} />
      <PageScrollRegion className="flex flex-col gap-4">
      <p className="text-sm text-cadence-ink/60">
        {task.status} · {TASK_TYPE_LABELS[task.type as TaskType] ?? task.type}
        {task.due_date ? ` · due ${task.due_date}` : ""}
      </p>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-cadence-ink/60">Created</dt>
          <dd>{timeZone ? formatDateTime(task.created_at, timeZone) : "—"}</dd>
        </div>
        <div>
          <dt className="text-cadence-ink/60">Assignee</dt>
          <dd>{assigneeLabel}</dd>
        </div>
        <div>
          <dt className="text-cadence-ink/60">Related</dt>
          <dd>
            {task.related_entity_type ?? "—"}
            {task.related_entity_id ? ` ····${task.related_entity_id.slice(-4)}` : ""}
          </dd>
        </div>
      </dl>
      {task.status === "done" ? (
        <PermGate anyOf={PERM.TASKS_COMPLETE}>
          <div>
            <Button
              onClick={async () => {
                setActionError(null);
                try {
                  await reopenTask(task.id);
                  await queryClient.invalidateQueries({ queryKey: taskKeys.all });
                } catch (error) {
                  setActionError(messageFrom(error));
                }
              }}
            >
              Reopen
            </Button>
          </div>
        </PermGate>
      ) : null}
      {actionError ? (
        <p role="alert" className="text-sm text-cadence-red">
          {actionError}
        </p>
      ) : null}
    </PageScrollRegion>
    </PageFrame>
  );
}
