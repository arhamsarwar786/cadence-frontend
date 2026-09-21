"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { listClients } from "@/features/clients/api";
import { createHourSheet, uploadHourSheet } from "@/features/jobs/actions";
import { hourSheetKeys, listHourSheets, listJobs } from "@/features/jobs/api";
import { HourSheetStatusBadge } from "@/features/jobs/components/StatusBadges";
import { hourSheetSchema, type HourSheetFormValues } from "@/features/jobs/schemas";
import type { HourSheet } from "@/features/jobs/types";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import type { HourSheetStatus } from "@/shared/lib/status-labels";
import { PERM } from "@/permissions/keys";
import { Button, Dialog, Field, Input, ListSkeleton, Pagination, PermGate, Select, Table, type Column } from "@/shared/ui";

const PAGE_SIZE = 50;
const FIELD_NAMES = Object.keys(hourSheetSchema.shape);

function NewHourSheetForm({ onDone }: { onDone: (id: string) => void }) {
  const clientsQuery = useQuery({ queryKey: ["clients-picker"], queryFn: () => listClients({ pageSize: 200 }) });
  const jobsQuery = useQuery({ queryKey: ["jobs-picker"], queryFn: () => listJobs({ pageSize: 200 }) });
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<HourSheetFormValues>({ resolver: zodResolver(hourSheetSchema) });

  async function submit(values: HourSheetFormValues) {
    setFormError(null);
    try {
      const sheet = await createHourSheet({
        client_id: values.client_id,
        job_id: values.job_id || undefined,
        period_start: values.period_start,
        period_end: values.period_end,
      });
      onDone(sheet.id);
    } catch (error) {
      const matched = applyFieldErrors(setError, error, FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
      <Field label="Client" htmlFor="hs-client" error={errors.client_id?.message}>
        <Select id="hs-client" {...register("client_id")}>
          <option value="">Select…</option>
          {clientsQuery.data?.results.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Job (optional)" htmlFor="hs-job" error={errors.job_id?.message}>
        <Select id="hs-job" {...register("job_id")}>
          <option value="">—</option>
          {jobsQuery.data?.results.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Period start" htmlFor="hs-start" error={errors.period_start?.message}>
          <input
            id="hs-start"
            type="date"
            className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm font-body text-cadence-ink"
            {...register("period_start")}
          />
        </Field>
        <Field label="Period end" htmlFor="hs-end" error={errors.period_end?.message}>
          <input
            id="hs-end"
            type="date"
            className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm font-body text-cadence-ink"
            {...register("period_end")}
          />
        </Field>
      </div>
      {formError ? <p className="font-body text-sm text-cadence-red">{formError}</p> : null}
      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? "Creating…" : "Create"}
      </Button>
    </form>
  );
}

export default function HourSheetsListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const [newOpen, setNewOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const query = useQuery({
    queryKey: hourSheetKeys.list({ page }),
    queryFn: () => listHourSheets({ page, pageSize: PAGE_SIZE }),
  });

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(nextPage));
    router.push(`/hour-sheets?${params.toString()}`);
  }

  const columns: Column<HourSheet>[] = [
    { header: "Job", cell: (h) => h.job_title ?? "—" },
    { header: "Client", cell: (h) => h.client_name },
    { header: "Period", cell: (h) => `${h.period_start} – ${h.period_end}` },
    {
      header: "Status",
      cell: (h) => <HourSheetStatusBadge status={h.status as HourSheetStatus} />,
    },
    { header: "Source", cell: (h) => h.source },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl text-cadence-ink">Hour sheets</h1>
        <PermGate anyOf={PERM.HOURSHEETS_EDIT}>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setUploadOpen(true)}>
              Upload
            </Button>
            <Button onClick={() => setNewOpen(true)}>New hour sheet</Button>
          </div>
        </PermGate>
      </div>

      {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError ? (
        <p className="font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>
      ) : (
        <>
          <Table
            columns={columns}
            rows={query.data?.results ?? []}
            rowKey={(h) => h.id}
            onRowClick={(h) => router.push(`/hour-sheets/${h.id}`)}
            emptyMessage="No hour sheets yet."
          />
          {query.data ? (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              count={query.data.count}
              onPageChange={goToPage}
            />
          ) : null}
        </>
      )}

      <Dialog open={newOpen} onClose={() => setNewOpen(false)} title="New hour sheet">
        <NewHourSheetForm
          onDone={(id) => {
            setNewOpen(false);
            queryClient.invalidateQueries({ queryKey: hourSheetKeys.all });
            router.push(`/hour-sheets/${id}`);
          }}
        />
      </Dialog>
      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload hour sheet">
        <UploadHourSheetForm
          onDone={(id) => {
            setUploadOpen(false);
            queryClient.invalidateQueries({ queryKey: hourSheetKeys.all });
            router.push(`/hour-sheets/${id}`);
          }}
        />
      </Dialog>
    </div>
  );
}

function UploadHourSheetForm({ onDone }: { onDone: (id: string) => void }) {
  const clientsQuery = useQuery({ queryKey: ["clients-picker"], queryFn: () => listClients({ pageSize: 200 }) });
  const jobsQuery = useQuery({ queryKey: ["jobs-picker"], queryFn: () => listJobs({ pageSize: 200 }) });
  const [clientId, setClientId] = useState("");
  const [jobId, setJobId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !clientId || !periodStart || !periodEnd) {
      setFormError("Client, period, and file are required.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const sheet = await uploadHourSheet(file, {
        client_id: clientId,
        job_id: jobId || undefined,
        period_start: periodStart,
        period_end: periodEnd,
      });
      onDone(sheet.id);
    } catch (error) {
      setFormError(messageFrom(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Client" htmlFor="up-client">
        <Select id="up-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Select…</option>
          {(clientsQuery.data?.results ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Job (optional)" htmlFor="up-job">
        <Select id="up-job" value={jobId} onChange={(e) => setJobId(e.target.value)}>
          <option value="">—</option>
          {(jobsQuery.data?.results ?? []).map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Period start" htmlFor="up-start">
          <Input id="up-start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        </Field>
        <Field label="Period end" htmlFor="up-end">
          <Input id="up-end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </Field>
      </div>
      <Field label="File" htmlFor="up-file">
        <Input
          id="up-file"
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </Field>
      {formError ? <p className="text-sm text-cadence-red">{formError}</p> : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Uploading…" : "Upload"}
      </Button>
    </form>
  );
}
