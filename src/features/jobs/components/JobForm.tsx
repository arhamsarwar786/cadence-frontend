"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { listClients } from "@/features/clients/api";
import { jobFormSchema, type JobFormValues } from "@/features/jobs/schemas";
import { PERM } from "@/permissions/keys";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import { Button, Field, Input, Select, useHasPerm } from "@/shared/ui";

const FIELD_NAMES = Object.keys(jobFormSchema(true).shape);

export interface JobFormProps {
  defaultValues?: Partial<JobFormValues>;
  onSubmit: (values: JobFormValues) => Promise<void>;
  submitLabel?: string;
  /** Locked once a job exists — the client relationship isn't editable
   * after creation in this build. */
  lockClient?: boolean;
  mode?: "create" | "edit";
}

export function JobForm({
  defaultValues,
  onSubmit,
  submitLabel = "Save",
  lockClient,
  mode = "create",
}: JobFormProps) {
  const canEditBillRate = useHasPerm(PERM.JOBS_BILL_RATE_EDIT);
  const canEditMarkup = useHasPerm(PERM.CLIENTS_MARKUP_EDIT);
  const schema = useMemo(() => jobFormSchema(canEditBillRate), [canEditBillRate]);
  const clientsQuery = useQuery({
    queryKey: ["clients-picker"],
    queryFn: () => listClients({ pageSize: 200 }),
  });
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<JobFormValues>({
    resolver: zodResolver(schema) as Resolver<JobFormValues>,
    defaultValues: { bill_rate_unit: "hr", ...defaultValues },
  });

  async function submit(values: JobFormValues) {
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      const formMessage = applyFieldErrors(setError, error, FIELD_NAMES);
      if (formMessage) setFormError(formMessage);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="flex max-w-xl flex-col gap-4">
      {mode === "create" && !canEditBillRate ? (
        <p className="rounded-xl border border-cadence-orange/40 bg-cadence-orange/10 px-3 py-2 font-body text-sm text-cadence-ink">
          Creating a job requires setting a bill rate. Your account needs{" "}
          <strong>jobs.bill_rate.edit</strong> — ask your office administrator to add it to your
          role.
        </p>
      ) : null}
      <Field label="Title" htmlFor="title" error={errors.title?.message}>
        <Input id="title" {...register("title")} />
      </Field>
      <Field label="Client" htmlFor="client" error={errors.client?.message}>
        <Select id="client" disabled={lockClient} {...register("client")}>
          <option value="">Select…</option>
          {clientsQuery.data?.results.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Start" htmlFor="start_datetime" error={errors.start_datetime?.message}>
          <Input id="start_datetime" type="datetime-local" {...register("start_datetime")} />
        </Field>
        <Field label="End" htmlFor="end_datetime" error={errors.end_datetime?.message}>
          <Input id="end_datetime" type="datetime-local" {...register("end_datetime")} />
        </Field>
      </div>
      {canEditBillRate ? (
        <div className="grid grid-cols-3 gap-4">
          <Field label="Bill rate" htmlFor="bill_rate" error={errors.bill_rate?.message}>
            <Input id="bill_rate" {...register("bill_rate")} />
          </Field>
          <Field
            label="Bill rate unit"
            htmlFor="bill_rate_unit"
            error={errors.bill_rate_unit?.message}
          >
            <Select id="bill_rate_unit" {...register("bill_rate_unit")}>
              <option value="hr">Per hour</option>
              <option value="day">Per day</option>
              <option value="flat">Flat</option>
            </Select>
          </Field>
          {canEditMarkup ? (
            <Field
              label="Markup % override"
              htmlFor="markup_pct"
              error={errors.markup_pct?.message}
              hint="Blank uses the client's"
            >
              <Input id="markup_pct" {...register("markup_pct")} />
            </Field>
          ) : (
            <p className="self-end font-body text-xs text-cadence-ink/55">
              Markup override requires <strong>clients.markup.edit</strong>.
            </p>
          )}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Headcount needed"
          htmlFor="headcount_needed"
          error={errors.headcount_needed?.message}
        >
          <Input id="headcount_needed" type="number" min={1} {...register("headcount_needed")} />
        </Field>
        <Field label="PO number" htmlFor="po_number" error={errors.po_number?.message}>
          <Input id="po_number" {...register("po_number")} />
        </Field>
      </div>
      <Field label="Invoice date" htmlFor="invoice_date" error={errors.invoice_date?.message}>
        <Input id="invoice_date" type="date" {...register("invoice_date")} />
      </Field>
      {formError ? <p className="font-body text-sm text-cadence-red">{formError}</p> : null}
      <Button
        type="submit"
        disabled={isSubmitting || (mode === "create" && !canEditBillRate)}
        className="self-start"
      >
        {isSubmitting ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
