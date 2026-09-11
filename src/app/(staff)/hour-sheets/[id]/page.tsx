"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notFound, useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  addHourSheetLine,
  approveHourSheet,
  deleteHourSheetLine,
  unapproveHourSheet,
} from "@/features/jobs/actions";
import { getHourSheet, hourSheetKeys, listHourSheetLines } from "@/features/jobs/api";
import { HourSheetStatusBadge } from "@/features/jobs/components/StatusBadges";
import { hourSheetLineSchema, type HourSheetLineFormValues } from "@/features/jobs/schemas";
import { listWorkers } from "@/features/workers/api";
import { applyFieldErrors, isNotFound, messageFrom } from "@/shared/lib/errors";
import {
  MATCH_STATUS_LABELS,
  type HourSheetStatus,
  type MatchStatus,
} from "@/shared/lib/status-labels";
import { Badge, Button, Dialog, Field, Input, Select, type BadgeTone } from "@/shared/ui";

const LINE_FIELD_NAMES = Object.keys(hourSheetLineSchema.shape);

const MATCH_TONE: Record<MatchStatus, BadgeTone> = {
  matched: "positive",
  unmatched: "warning",
  ambiguous: "warning",
  blocked: "negative",
};

function AddLineForm({ sheetId, onDone }: { sheetId: string; onDone: () => void }) {
  const workersQuery = useQuery({
    queryKey: ["workers-picker"],
    queryFn: () => listWorkers({ pageSize: 200 }),
  });
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<HourSheetLineFormValues>({ resolver: zodResolver(hourSheetLineSchema) });

  async function submit(values: HourSheetLineFormValues) {
    setFormError(null);
    try {
      await addHourSheetLine(sheetId, {
        employee_id: values.employee_id,
        hours: values.hours,
        work_date: values.work_date || undefined,
        range_from: values.range_from || undefined,
        range_to: values.range_to || undefined,
        raw_text: values.raw_text || "",
      });
      onDone();
    } catch (error) {
      const matched = applyFieldErrors(setError, error, LINE_FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
      <Field label="Employee" htmlFor="line-employee" error={errors.employee_id?.message}>
        <Select id="line-employee" {...register("employee_id")}>
          <option value="">Select…</option>
          {workersQuery.data?.results.map((w) => (
            <option key={w.id} value={w.id}>
              {w.first_name} {w.last_name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Work date" htmlFor="line-date" error={errors.work_date?.message}>
        <Input id="line-date" type="date" {...register("work_date")} />
      </Field>
      <Field label="Hours" htmlFor="line-hours" error={errors.hours?.message}>
        <Input id="line-hours" {...register("hours")} />
      </Field>
      {formError ? <p className="font-body text-sm text-cadence-red">{formError}</p> : null}
      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? "Adding…" : "Add line"}
      </Button>
    </form>
  );
}

export default function HourSheetDetailPage() {
  const { id: sheetId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const sheetQuery = useQuery({
    queryKey: hourSheetKeys.detail(sheetId),
    queryFn: () => getHourSheet(sheetId),
    retry: false,
  });
  const linesKey = ["hour-sheets", sheetId, "lines"] as const;
  const linesQuery = useQuery({ queryKey: linesKey, queryFn: () => listHourSheetLines(sheetId) });

  if (sheetQuery.isError && isNotFound(sheetQuery.error)) notFound();

  function refetchSheet() {
    return queryClient.invalidateQueries({ queryKey: hourSheetKeys.detail(sheetId) });
  }
  function refetchLines() {
    return queryClient.invalidateQueries({ queryKey: linesKey });
  }

  const allMatched = (linesQuery.data ?? []).every((l) => l.match_status === "matched");
  const hasLines = (linesQuery.data ?? []).length > 0;

  async function handleApprove() {
    setActionError(null);
    try {
      await approveHourSheet(sheetId);
      await refetchSheet();
    } catch (error) {
      setActionError(messageFrom(error));
    }
  }

  async function handleUnapprove() {
    setActionError(null);
    try {
      await unapproveHourSheet(sheetId);
      await refetchSheet();
    } catch (error) {
      setActionError(messageFrom(error));
    }
  }

  async function handleDeleteLine(lineId: string) {
    if (!window.confirm("Remove this line?")) return;
    await deleteHourSheetLine(sheetId, lineId);
    await refetchLines();
  }

  if (sheetQuery.isLoading) return <p className="font-body text-sm text-cadence-ink/60">Loading…</p>;
  if (sheetQuery.isError) {
    return <p className="font-body text-sm text-cadence-red">{messageFrom(sheetQuery.error)}</p>;
  }
  const sheet = sheetQuery.data;
  if (!sheet) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-3xl text-cadence-ink">
            {sheet.job_title ?? sheet.client_name}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <HourSheetStatusBadge status={sheet.status as HourSheetStatus} />
            <span className="font-body text-sm text-cadence-ink/60">
              {sheet.period_start} – {sheet.period_end}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {sheet.status === "received" ? (
            <Button onClick={handleApprove} disabled={!hasLines || !allMatched}>
              Approve
            </Button>
          ) : (
            <Button variant="secondary" onClick={handleUnapprove}>
              Unapprove
            </Button>
          )}
        </div>
      </div>
      {sheet.status === "received" && hasLines && !allMatched ? (
        <p className="font-body text-xs text-cadence-ink/60">
          Approve is disabled until every line is matched.
        </p>
      ) : null}
      {actionError ? <p className="font-body text-sm text-cadence-red">{actionError}</p> : null}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-subheading text-xl text-cadence-ink">Lines</h2>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            Add line
          </Button>
        </div>

        {linesQuery.isLoading ? (
          <p className="font-body text-sm text-cadence-ink/60">Loading…</p>
        ) : linesQuery.data && linesQuery.data.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {linesQuery.data.map((line) => (
              <li key={line.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-body text-sm font-medium text-cadence-ink">
                    {line.employee_name} · {line.hours}h
                    {line.work_date ? ` · ${line.work_date}` : ""}
                  </p>
                  {line.raw_text ? (
                    <p className="font-body text-xs text-cadence-ink/60">{line.raw_text}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {line.match_status ? (
                    <Badge tone={MATCH_TONE[line.match_status as MatchStatus]}>
                      {MATCH_STATUS_LABELS[line.match_status as MatchStatus]}
                    </Badge>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteLine(line.id)}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-body text-sm text-cadence-ink/60">No lines yet.</p>
        )}
      </section>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} title="Add line">
        <AddLineForm
          sheetId={sheetId}
          onDone={() => {
            setAddOpen(false);
            void refetchLines();
          }}
        />
      </Dialog>
    </div>
  );
}
