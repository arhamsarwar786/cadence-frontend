"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { listWorkers } from "@/features/workers/api";
import { createPrivacyRequest, listPrivacyRequests, privacyRequestKeys } from "@/features/privacy/api";
import type { PrivacyRequest } from "@/features/privacy/types";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import {
  PRIVACY_REQUEST_STATUS_LABELS,
  PRIVACY_REQUEST_TYPE_LABELS,
  type PrivacyRequestStatus,
  type PrivacyRequestType,
} from "@/shared/lib/status-labels";
import { Badge, Button, Dialog, Field, Pagination, Select, Table, type Column } from "@/shared/ui";

const PAGE_SIZE = 50;
const createSchema = z.object({
  employee_id: z.string().min(1, "Pick a worker."),
  type: z.enum(["access", "correction"]),
  received_on: z.string().optional().or(z.literal("")),
});
type CreateFormValues = z.infer<typeof createSchema>;
const FIELD_NAMES = Object.keys(createSchema.shape);

export default function PrivacyRequestsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: privacyRequestKeys.list({ page }),
    queryFn: () => listPrivacyRequests(page),
  });
  const workersQuery = useQuery({ queryKey: ["workers-picker"], queryFn: () => listWorkers({ pageSize: 200 }) });

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateFormValues>({ resolver: zodResolver(createSchema) });

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(nextPage));
    router.push(`/privacy?${params.toString()}`);
  }

  async function submit(values: CreateFormValues) {
    setFormError(null);
    try {
      const req = await createPrivacyRequest({
        employee_id: values.employee_id,
        type: values.type,
        received_on: values.received_on || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: privacyRequestKeys.all });
      reset();
      setOpen(false);
      router.push(`/privacy/${req.id}`);
    } catch (error) {
      const matched = applyFieldErrors(setError, error, FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
    }
  }

  const columns: Column<PrivacyRequest>[] = [
    { header: "Type", cell: (r) => PRIVACY_REQUEST_TYPE_LABELS[r.type as PrivacyRequestType] },
    {
      header: "Status",
      cell: (r) => (
        <Badge tone={r.status === "answered" ? "positive" : "warning"}>
          {PRIVACY_REQUEST_STATUS_LABELS[r.status as PrivacyRequestStatus]}
        </Badge>
      ),
    },
    { header: "Received", cell: (r) => r.received_on },
    { header: "Due", cell: (r) => r.due_on },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl text-cadence-ink">Privacy requests</h1>
        <Button onClick={() => setOpen(true)}>New request</Button>
      </div>

      {query.isLoading ? (
        <p className="font-body text-sm text-cadence-ink/60">Loading…</p>
      ) : query.isError ? (
        <p className="font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>
      ) : (
        <>
          <Table
            columns={columns}
            rows={query.data?.results ?? []}
            rowKey={(r) => r.id}
            onRowClick={(r) => router.push(`/privacy/${r.id}`)}
            emptyMessage="No privacy requests."
          />
          {query.data ? (
            <Pagination page={page} pageSize={PAGE_SIZE} count={query.data.count} onPageChange={goToPage} />
          ) : null}
        </>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="New privacy request">
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <Field label="Worker" htmlFor="pr-employee" error={errors.employee_id?.message}>
            <Select id="pr-employee" {...register("employee_id")}>
              <option value="">Select…</option>
              {workersQuery.data?.results.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.first_name} {w.last_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Type" htmlFor="pr-type" error={errors.type?.message}>
            <Select id="pr-type" {...register("type")}>
              <option value="access">Access</option>
              <option value="correction">Correction</option>
            </Select>
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
