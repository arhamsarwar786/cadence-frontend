"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { createAssignment } from "@/features/jobs/actions";
import { listJobAssignments } from "@/features/jobs/api";
import { AssignmentStatusBadge } from "@/features/jobs/components/StatusBadges";
import { listWorkers } from "@/features/workers/api";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import type { AssignmentStatus } from "@/shared/lib/status-labels";
import { formatMoney } from "@/shared/lib/money";
import { Button, Dialog, Field, Select } from "@/shared/ui";
import { z } from "zod";

const assignSchema = z.object({ employee_id: z.string().min(1, "Pick a worker.") });
type AssignFormValues = z.infer<typeof assignSchema>;
const FIELD_NAMES = Object.keys(assignSchema.shape);

export function AssignmentsPanel({ jobId }: { jobId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["jobs", jobId, "assignments"] as const;
  const query = useQuery({ queryKey, queryFn: () => listJobAssignments(jobId) });
  const workersQuery = useQuery({
    queryKey: ["workers-picker"],
    queryFn: () => listWorkers({ pageSize: 200 }),
  });
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AssignFormValues>({ resolver: zodResolver(assignSchema) });

  async function submit(values: AssignFormValues) {
    setFormError(null);
    try {
      await createAssignment(jobId, values);
      await queryClient.invalidateQueries({ queryKey });
      reset();
      setOpen(false);
    } catch (error) {
      const matched = applyFieldErrors(setError, error, FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-subheading text-xl text-cadence-ink">Assignments</h2>
        <Button size="sm" onClick={() => setOpen(true)}>
          Assign worker
        </Button>
      </div>

      {query.isLoading ? (
        <p className="font-body text-sm text-cadence-ink/60">Loading…</p>
      ) : query.data && query.data.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {query.data.map((a) => (
            <li key={a.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <Link href={`/assignments/${a.id}`} className="font-body text-sm font-medium text-cadence-ink hover:underline">
                  {a.employee_name}
                </Link>
                <p className="font-body text-xs text-cadence-ink/60">
                  {"pay_rate" in a ? `Pay ${formatMoney(a.pay_rate)}` : ""}
                </p>
              </div>
              <AssignmentStatusBadge status={a.status as AssignmentStatus} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-sm text-cadence-ink/60">No one assigned yet.</p>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Assign worker">
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <Field label="Worker" htmlFor="assign-employee" error={errors.employee_id?.message}>
            <Select id="assign-employee" {...register("employee_id")}>
              <option value="">Select…</option>
              {workersQuery.data?.results.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.first_name} {w.last_name}
                </option>
              ))}
            </Select>
          </Field>
          {formError ? <p className="font-body text-sm text-cadence-red">{formError}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Assigning…" : "Assign"}
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
