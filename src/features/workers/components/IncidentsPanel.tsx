"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { logIncident, voidIncident } from "@/features/workers/actions";
import { listIncidentWeights, listWorkerIncidents } from "@/features/workers/api";
import {
  incidentLogSchema,
  incidentVoidSchema,
  type IncidentLogFormValues,
  type IncidentVoidFormValues,
} from "@/features/workers/schemas";
import type { WorkerIncident } from "@/features/workers/types";
import { useOrgTimeZone } from "@/auth/use-org-timezone";
import { formatDateTime } from "@/shared/lib/datetime";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import { Badge, Button, Dialog, Field, Input, Select } from "@/shared/ui";

const LOG_FIELD_NAMES = Object.keys(incidentLogSchema.shape);
const VOID_FIELD_NAMES = Object.keys(incidentVoidSchema.shape);

function LogIncidentForm({ workerId, onDone }: { workerId: string; onDone: () => void }) {
  const catalogQuery = useQuery({ queryKey: ["incident-weights"], queryFn: listIncidentWeights });
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<IncidentLogFormValues>({ resolver: zodResolver(incidentLogSchema) });

  async function submit(values: IncidentLogFormValues) {
    setFormError(null);
    try {
      await logIncident(workerId, { ...values, note: values.note ?? "" });
      onDone();
    } catch (error) {
      const matched = applyFieldErrors(setError, error, LOG_FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
      <Field label="Category" htmlFor="inc-category" error={errors.category?.message}>
        <Select id="inc-category" {...register("category")}>
          <option value="">Select…</option>
          {catalogQuery.data?.map((weight) => (
            <option key={weight.id} value={weight.category}>
              {weight.category} ({weight.type}, {weight.default_weight})
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Occurred at" htmlFor="inc-occurred" error={errors.occurred_at?.message}>
        <Input id="inc-occurred" type="datetime-local" {...register("occurred_at")} />
      </Field>
      <Field label="Note" htmlFor="inc-note" error={errors.note?.message}>
        <Input id="inc-note" {...register("note")} />
      </Field>
      {formError ? <p className="font-body text-sm text-cadence-red">{formError}</p> : null}
      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? "Logging…" : "Log incident"}
      </Button>
    </form>
  );
}

function VoidIncidentForm({
  workerId,
  incident,
  onDone,
}: {
  workerId: string;
  incident: WorkerIncident;
  onDone: () => void;
}) {
  const timeZone = useOrgTimeZone();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<IncidentVoidFormValues>({ resolver: zodResolver(incidentVoidSchema) });

  async function submit(values: IncidentVoidFormValues) {
    setFormError(null);
    try {
      await voidIncident(workerId, incident.id, values);
      onDone();
    } catch (error) {
      const matched = applyFieldErrors(setError, error, VOID_FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
      <p className="font-body text-sm text-cadence-ink">
        Void the {incident.category} incident from{" "}
        {timeZone ? formatDateTime(incident.occurred_at, timeZone) : "—"}?
        Incidents are never deleted — this keeps the row, marked void.
      </p>
      <Field label="Reason" htmlFor="void-reason" error={errors.reason?.message}>
        <Input id="void-reason" {...register("reason")} />
      </Field>
      {formError ? <p className="font-body text-sm text-cadence-red">{formError}</p> : null}
      <Button type="submit" variant="danger" disabled={isSubmitting} className="self-start">
        {isSubmitting ? "Voiding…" : "Void incident"}
      </Button>
    </form>
  );
}

export function IncidentsPanel({ workerId }: { workerId: string }) {
  const queryClient = useQueryClient();
  const timeZone = useOrgTimeZone();
  const queryKey = ["workers", workerId, "incidents"] as const;
  const query = useQuery({ queryKey, queryFn: () => listWorkerIncidents(workerId) });
  const [logOpen, setLogOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<WorkerIncident | null>(null);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey });
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-subheading text-xl text-cadence-ink">Incidents</h2>
        <Button size="sm" onClick={() => setLogOpen(true)}>
          Log incident
        </Button>
      </div>

      {query.isLoading ? (
        <p className="font-body text-sm text-cadence-ink/60">Loading…</p>
      ) : query.data && query.data.results.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {query.data.results.map((incident) => (
            <li key={incident.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-body text-sm font-medium text-cadence-ink">
                  {incident.category}{" "}
                  <Badge tone={incident.type === "positive" ? "positive" : "negative"}>
                    {incident.type}
                  </Badge>
                  {incident.is_void ? (
                    <Badge tone="neutral" className="ml-2">
                      Void
                    </Badge>
                  ) : null}
                </p>
                <p className="font-body text-xs text-cadence-ink/60">
                  {timeZone ? formatDateTime(incident.occurred_at, timeZone) : "—"} · weight{" "}
                  {incident.weight}
                  {incident.note ? ` · ${incident.note}` : ""}
                </p>
              </div>
              {!incident.is_void ? (
                <Button size="sm" variant="ghost" onClick={() => setVoidTarget(incident)}>
                  Void
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-sm text-cadence-ink/60">No incidents logged.</p>
      )}

      <Dialog open={logOpen} onClose={() => setLogOpen(false)} title="Log incident">
        <LogIncidentForm
          workerId={workerId}
          onDone={() => {
            setLogOpen(false);
            void invalidate();
          }}
        />
      </Dialog>

      <Dialog open={voidTarget !== null} onClose={() => setVoidTarget(null)} title="Void incident">
        {voidTarget ? (
          <VoidIncidentForm
            workerId={workerId}
            incident={voidTarget}
            onDone={() => {
              setVoidTarget(null);
              void invalidate();
            }}
          />
        ) : null}
      </Dialog>
    </section>
  );
}
