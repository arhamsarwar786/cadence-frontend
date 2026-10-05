"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { listClients } from "@/features/clients/api";
import { createHourSheet, uploadHourSheet } from "@/features/jobs/actions";
import { hourSheetKeys, listHourSheets, listJobs } from "@/features/jobs/api";
import { HourSheetStatusBadge } from "@/features/jobs/components/StatusBadges";
import { hourSheetSchema, type HourSheetFormValues } from "@/features/jobs/schemas";
import type { HourSheet } from "@/features/jobs/types";
import { ListError } from "@/features/jobs/components/ListError";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import { matchesQuery } from "@/shared/lib/matches";
import { HOUR_SHEET_STATUS_LABELS, type HourSheetStatus } from "@/shared/lib/status-labels";
import { PERM } from "@/permissions/keys";
import {
  Button,
  Dialog,
  Field,
  FilterChip,
  Input,
  ListLayout,
  ListSkeleton,
  PageBody,
  PageFrame,
  PageHeader,
  Pagination,
  PermGate,
  SearchField,
  Select,
  Table,
  type Column,
} from "@/shared/ui";
import { fetchAllPages } from "@/api/client";

const PAGE_SIZE = 50;
/** The text find narrows the rows of one wide page (the API has no search). */
const FIND_WINDOW = 200;
const STATUS_FILTERS = Object.keys(HOUR_SHEET_STATUS_LABELS) as HourSheetStatus[];
const FIELD_NAMES = Object.keys(hourSheetSchema.shape);

function NewHourSheetForm({ onDone }: { onDone: (id: string) => void }) {
  const clientsQuery = useQuery({ queryKey: ["clients-picker"], queryFn: () => fetchAllPages((page) => listClients({ pageSize: 200, page })) });
  const jobsQuery = useQuery({ queryKey: ["jobs-picker"], queryFn: () => fetchAllPages((page) => listJobs({ pageSize: 200, page })) });
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
      const banner = applyFieldErrors(setError, error, FIELD_NAMES);
      if (banner) setFormError(banner);
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
  const rawStatus = searchParams.get("status") ?? "";
  // Only a known status reaches the API (anything else is its 400).
  const status = (STATUS_FILTERS as string[]).includes(rawStatus)
    ? (rawStatus as HourSheetStatus)
    : undefined;
  const q = searchParams.get("q") ?? "";
  const finding = q.trim().length > 0;
  const [newOpen, setNewOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const query = useQuery({
    queryKey: hourSheetKeys.list({ page: finding ? 1 : page, status, find: finding }),
    queryFn: () =>
      listHourSheets({
        page: finding ? 1 : page,
        pageSize: finding ? FIND_WINDOW : PAGE_SIZE,
        status,
      }),
  });

  const rows = useMemo(() => {
    const results = query.data?.results ?? [];
    if (!finding) return results;
    return results.filter(
      (h) =>
        matchesQuery(h.client_name, q) ||
        matchesQuery(h.job_title ?? "", q) ||
        matchesQuery(`${h.period_start} ${h.period_end}`, q),
    );
  }, [finding, q, query.data?.results]);

  function setParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`/hour-sheets?${params.toString()}`);
  }

  function goToPage(nextPage: number) {
    setParams({ page: String(nextPage) });
  }

  const columns: Column<HourSheet>[] = [
    { header: "Job", cell: (h) => h.job_title ?? "—" },
    { header: "Client", cell: (h) => h.client_name },
    { header: "Period", cell: (h) => `${h.period_start} – ${h.period_end}`, className: "whitespace-nowrap" },
    {
      header: "Status",
      cell: (h) => <HourSheetStatusBadge status={h.status as HourSheetStatus} />,
    },
    { header: "Source", cell: (h) => h.source },
  ];

  return (
    <PageFrame>
      <PageHeader
        title="Hour sheets"
        actions={
          <PermGate anyOf={PERM.HOURSHEETS_EDIT}>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setUploadOpen(true)}>
                Upload
              </Button>
              <Button onClick={() => setNewOpen(true)}>New hour sheet</Button>
            </div>
          </PermGate>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchField
          value={q}
          onChange={(next) => setParams({ q: next || null, page: "1" })}
          placeholder="Find by client or job"
          label="Find hour sheets"
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          <FilterChip active={!status} onClick={() => setParams({ status: null, page: "1" })}>
            All
          </FilterChip>
          {STATUS_FILTERS.map((s) => (
            <FilterChip
              key={s}
              active={status === s}
              onClick={() => setParams({ status: s, page: "1" })}
            >
              {HOUR_SHEET_STATUS_LABELS[s]}
            </FilterChip>
          ))}
        </div>
      </div>

      <PageBody>
        {query.isLoading ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ListError
            error={query.error}
            page={page}
            onRetry={() => query.refetch()}
            onFirstPage={() => goToPage(1)}
          />
        ) : (
          <ListLayout
            stats={[
              {
                value: finding ? rows.length : (query.data?.count ?? 0),
                label: finding ? "matches" : "hour sheets",
                tone: "ink",
              },
            ]}
          >
            <div className="flex min-h-0 flex-col gap-4">
              {finding && (query.data?.count ?? 0) > FIND_WINDOW ? (
                <p className="font-body text-xs text-cadence-ink/60">
                  Showing matches in the first {FIND_WINDOW} of {query.data?.count} hour sheets.
                </p>
              ) : null}
              <Table
                columns={columns}
                rows={rows}
                rowKey={(h) => h.id}
                onRowClick={(h) => router.push(`/hour-sheets/${h.id}`)}
                emptyMessage={
                  finding
                    ? "No hour sheets match that find."
                    : status
                      ? `No ${HOUR_SHEET_STATUS_LABELS[status].toLowerCase()} hour sheets.`
                      : "No hour sheets yet."
                }
              />
              {!finding && query.data ? (
                <Pagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  count={query.data.count}
                  onPageChange={goToPage}
                />
              ) : null}
            </div>
          </ListLayout>
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
    </PageBody>
    </PageFrame>
  );
}

function UploadHourSheetForm({ onDone }: { onDone: (id: string) => void }) {
  const clientsQuery = useQuery({ queryKey: ["clients-picker"], queryFn: () => fetchAllPages((page) => listClients({ pageSize: 200, page })) });
  const jobsQuery = useQuery({ queryKey: ["jobs-picker"], queryFn: () => fetchAllPages((page) => listJobs({ pageSize: 200, page })) });
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
