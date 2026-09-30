"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  confirmPlacement,
  createPlacement,
  voidPlacement,
} from "@/features/money/actions";
import { getPlacement, listPlacements, placementKeys } from "@/features/money/api";
import type { Placement } from "@/features/money/types";
import { ListError } from "@/features/jobs/components/ListError";
import { useOrgTimeZone } from "@/auth/use-org-timezone";
import { listClients } from "@/features/clients/api";
import { listJobs } from "@/features/jobs/api";
import { placementCreateSchema, type PlacementCreateFormValues } from "@/features/money/schemas";
import { listWorkers } from "@/features/workers/api";
import { formatDate } from "@/shared/lib/datetime";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import { formatMoney } from "@/shared/lib/money";
import { PERM } from "@/permissions/keys";
import { Button, Chip, Dialog, Field, Input, ListLayout, ListSkeleton, PageHeader, Pagination, PermGate, Select, Table, useConfirm, type Column, PageFrame, PageBody } from "@/shared/ui";

const PAGE_SIZE = 50;

const FIELD_NAMES = Object.keys(placementCreateSchema.shape);

function NewPlacementForm({ onCreated }: { onCreated: (id: string) => Promise<void> }) {
  const clientsQuery = useQuery({
    queryKey: ["clients-picker"],
    queryFn: () => listClients({ pageSize: 200 }),
  });
  const workersQuery = useQuery({
    queryKey: ["workers-picker"],
    queryFn: () => listWorkers({ pageSize: 200 }),
  });
  const jobsQuery = useQuery({
    queryKey: ["jobs-picker"],
    queryFn: () => listJobs({ pageSize: 200 }),
  });
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PlacementCreateFormValues>({ resolver: zodResolver(placementCreateSchema) });
  const clientId = watch("client_id");
  const jobs = (jobsQuery.data?.results ?? []).filter((j) => !clientId || j.client_id === clientId);

  async function submit(values: PlacementCreateFormValues) {
    setFormError(null);
    try {
      const row = await createPlacement({
        client_id: values.client_id,
        employee_id: values.employee_id,
        job_id: values.job_id || null,
        annual_salary: values.annual_salary,
        fee_pct: values.fee_pct,
      });
      await onCreated(row.id);
    } catch (err) {
      const banner = applyFieldErrors(setError, err, FIELD_NAMES);
      if (banner) setFormError(banner);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-3">
      <Field label="Client" htmlFor="pl-client" error={errors.client_id?.message}>
        <Select id="pl-client" {...register("client_id")}>
          <option value="">Select…</option>
          {clientsQuery.data?.results.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Worker" htmlFor="pl-emp" error={errors.employee_id?.message}>
        <Select id="pl-emp" {...register("employee_id")}>
          <option value="">Select…</option>
          {workersQuery.data?.results.map((w) => (
            <option key={w.id} value={w.id}>
              {w.first_name} {w.last_name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Job (optional)" htmlFor="pl-job" error={errors.job_id?.message}>
        <Select id="pl-job" {...register("job_id")}>
          <option value="">No job</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Annual salary" htmlFor="pl-sal" error={errors.annual_salary?.message}>
        <Input id="pl-sal" {...register("annual_salary")} />
      </Field>
      <Field label="Fee %" htmlFor="pl-fee" error={errors.fee_pct?.message}>
        <Input id="pl-fee" {...register("fee_pct")} />
      </Field>
      {formError ? <p className="text-sm text-cadence-red">{formError}</p> : null}
      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? "Creating…" : "Create"}
      </Button>
    </form>
  );
}

export default function PermPlacementsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const queryClient = useQueryClient();
  const timeZone = useOrgTimeZone();
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: placementKeys.list({ page }),
    queryFn: () => listPlacements({ page, pageSize: PAGE_SIZE }),
  });

  const columns: Column<Placement>[] = [
    { header: "Worker", cell: (p) => p.employee_name },
    { header: "Client", cell: (p) => p.client_name },
    {
      header: "Status",
      cell: (p) => (
        <Chip tone={p.voided_at ? "danger" : p.status === "confirmed" ? "success" : "muted"}>
          {p.voided_at ? "voided" : p.status}
        </Chip>
      ),
    },
    {
      header: "Fee",
      cell: (p) => ("fee_amount" in p && p.fee_amount != null ? formatMoney(p.fee_amount) : "—"),
    },
    {
      header: "Confirmed",
      cell: (p) => (timeZone ? formatDate(p.confirmed_at, timeZone) : "—"),
    },
  ];

  return (
    <PageFrame>
      <PageHeader
        title="Permanent placements"
        actions={
          <PermGate anyOf={PERM.JOBS_ASSIGN}>
            <Button onClick={() => setOpen(true)}>New placement</Button>
          </PermGate>
        }
      />
      <PageBody>

        {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError ? (
        <ListError
            error={query.error}
            page={page}
            onRetry={() => query.refetch()}
            onFirstPage={() => router.push("/perm-placements")}
          />
      ) : (
        <ListLayout stats={[{ value: query.data?.count ?? 0, label: "placements", tone: "ink" }]}>
          <Table
            columns={columns}
            rows={query.data?.results ?? []}
            rowKey={(p) => p.id}
            onRowClick={(p) => router.push(`/perm-placements/${p.id}`)}
            emptyMessage="No permanent placements yet."
          />
          {query.data ? (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              count={query.data.count}
              onPageChange={(p) => router.push(`/perm-placements?page=${p}`)}
            />
          ) : null}
        </ListLayout>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="New permanent placement">
        <NewPlacementForm
          onCreated={async (id) => {
            await queryClient.invalidateQueries({ queryKey: placementKeys.all });
            setOpen(false);
            router.push(`/perm-placements/${id}`);
          }}
        />
      </Dialog>
    </PageBody>
    </PageFrame>
  );
}

export function PlacementActions({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const query = useQuery({ queryKey: placementKeys.detail(id), queryFn: () => getPlacement(id) });
  if (!query.data) return null;
  const p = query.data;

  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: placementKeys.detail(id) });
    } catch (err) {
      setActionError(messageFrom(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleVoid() {
    const ok = await confirm({
      title: "Void this placement?",
      body: "A voided placement can no longer be confirmed or invoiced. This cannot be undone from this screen.",
      confirmLabel: "Void placement",
      danger: true,
    });
    if (ok) await run(() => voidPlacement(id));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <PermGate anyOf={PERM.CLIENTS_INVOICE_EDIT}>
          {p.status === "offered" && !p.voided_at ? (
            <Button disabled={busy} onClick={() => run(() => confirmPlacement(id))}>
              Confirm
            </Button>
          ) : null}
          {!p.voided_at ? (
            <Button variant="danger" disabled={busy} onClick={handleVoid}>
              Void
            </Button>
          ) : null}
        </PermGate>
      </div>
      {actionError ? <p className="text-sm text-cadence-red">{actionError}</p> : null}
      {confirmDialog}
    </div>
  );
}
