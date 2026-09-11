"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notFound, useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/auth/session-context";
import { cancelJob, completeJob, deleteJob, updateJob } from "@/features/jobs/actions";
import { getJob, jobKeys, listShifts } from "@/features/jobs/api";
import { AssignmentsPanel } from "@/features/jobs/components/AssignmentsPanel";
import { JobForm } from "@/features/jobs/components/JobForm";
import { RequirementsPanel } from "@/features/jobs/components/RequirementsPanel";
import { JobStatusBadge, ShiftStatusBadge } from "@/features/jobs/components/StatusBadges";
import { ShiftPatternsPanel } from "@/features/jobs/components/ShiftPatternsPanel";
import type { JobFormValues } from "@/features/jobs/schemas";
import type { JobUpdate } from "@/features/jobs/types";
import { formatDateTime } from "@/shared/lib/datetime";
import { isNotFound, messageFrom } from "@/shared/lib/errors";
import { formatMoney } from "@/shared/lib/money";
import type { JobStatus, ShiftStatus } from "@/shared/lib/status-labels";
import { Button, Table, type Column } from "@/shared/ui";

export default function JobDetailPage() {
  const { id: jobId } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const [editing, setEditing] = useState(false);

  const query = useQuery({
    queryKey: jobKeys.detail(jobId),
    queryFn: () => getJob(jobId),
    retry: false,
  });
  const shiftsQuery = useQuery({
    queryKey: ["jobs", jobId, "shifts"],
    queryFn: () => listShifts({ job: jobId, pageSize: 200 }),
  });

  if (query.isError && isNotFound(query.error)) notFound();

  function refetch() {
    return queryClient.invalidateQueries({ queryKey: jobKeys.detail(jobId) });
  }

  async function handleUpdate(values: JobFormValues) {
    await updateJob(jobId, {
      title: values.title,
      bill_rate: values.bill_rate,
      bill_rate_unit: values.bill_rate_unit,
      markup_pct: values.markup_pct || undefined,
      headcount_needed: values.headcount_needed,
      start_datetime: values.start_datetime,
      end_datetime: values.end_datetime,
      po_number: values.po_number || undefined,
      invoice_date: values.invoice_date || undefined,
    } as JobUpdate);
    await refetch();
    setEditing(false);
  }

  async function handleCancel() {
    if (!window.confirm("Cancel this job?")) return;
    await cancelJob(jobId);
    await refetch();
  }

  async function handleComplete() {
    await completeJob(jobId);
    await refetch();
  }

  async function handleArchive() {
    if (!window.confirm("Archive this job?")) return;
    await deleteJob(jobId);
    router.push("/jobs");
  }

  if (query.isLoading) return <p className="font-body text-sm text-cadence-ink/60">Loading…</p>;
  if (query.isError) return <p className="font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>;
  const job = query.data;
  if (!job) return null;

  const shiftColumns: Column<NonNullable<typeof shiftsQuery.data>["results"][number]>[] = [
    { header: "Date", cell: (s) => s.shift_date },
    { header: "Employee", cell: (s) => s.employee_name },
    { header: "Time", cell: (s) => `${s.start_time}–${s.end_time}` },
    { header: "Status", cell: (s) => <ShiftStatusBadge status={s.status as ShiftStatus} /> },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-3xl text-cadence-ink">{job.title}</h1>
          <div className="mt-1 flex items-center gap-2">
            <JobStatusBadge status={job.status as JobStatus} />
            <span className="font-body text-sm text-cadence-ink/60">{job.client_name}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditing((v) => !v)}>
            {editing ? "Cancel edit" : "Edit"}
          </Button>
          {job.status === "open" || job.status === "filled" ? (
            <>
              <Button variant="secondary" onClick={handleComplete}>
                Mark completed
              </Button>
              <Button variant="danger" onClick={handleCancel}>
                Cancel job
              </Button>
            </>
          ) : null}
          {session?.user.is_root ? (
            <Button variant="ghost" onClick={handleArchive}>
              Archive
            </Button>
          ) : null}
        </div>
      </div>

      {editing ? (
        <JobForm
          defaultValues={{
            title: job.title,
            client: job.client_id,
            bill_rate: "bill_rate" in job ? job.bill_rate : undefined,
            bill_rate_unit: job.bill_rate_unit,
            markup_pct: "markup_pct" in job ? (job.markup_pct ?? "") : undefined,
            headcount_needed: job.headcount_needed,
            start_datetime: job.start_datetime,
            end_datetime: job.end_datetime,
            po_number: job.po_number ?? "",
            invoice_date: job.invoice_date ?? "",
          }}
          onSubmit={handleUpdate}
          submitLabel="Save changes"
          lockClient
        />
      ) : (
        <dl className="grid max-w-xl grid-cols-2 gap-x-8 gap-y-3 font-body text-sm">
          <div>
            <dt className="text-cadence-ink/60">Start</dt>
            <dd className="text-cadence-ink">{formatDateTime(job.start_datetime, "UTC")}</dd>
          </div>
          <div>
            <dt className="text-cadence-ink/60">End</dt>
            <dd className="text-cadence-ink">{formatDateTime(job.end_datetime, "UTC")}</dd>
          </div>
          <div>
            <dt className="text-cadence-ink/60">Bill rate</dt>
            <dd className="text-cadence-ink">
              {"bill_rate" in job ? `${formatMoney(job.bill_rate)} / ${job.bill_rate_unit}` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-cadence-ink/60">Headcount needed</dt>
            <dd className="text-cadence-ink">{job.headcount_needed ?? "—"}</dd>
          </div>
        </dl>
      )}

      <RequirementsPanel jobId={jobId} />
      <ShiftPatternsPanel jobId={jobId} />
      <AssignmentsPanel jobId={jobId} />

      <section className="flex flex-col gap-3">
        <h2 className="font-subheading text-xl text-cadence-ink">Shifts</h2>
        <Table
          columns={shiftColumns}
          rows={shiftsQuery.data?.results ?? []}
          rowKey={(s) => s.id}
          emptyMessage="No shifts generated yet."
        />
      </section>
    </div>
  );
}
