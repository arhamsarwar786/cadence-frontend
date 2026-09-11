"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { listClients } from "@/features/clients/api";
import { createInvoice } from "@/features/money/actions";
import { invoiceKeys } from "@/features/money/api";
import { invoiceCreateSchema, type InvoiceCreateFormValues } from "@/features/money/schemas";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import { Button, Field, Input, Select } from "@/shared/ui";

const FIELD_NAMES = Object.keys(invoiceCreateSchema.shape);

export default function NewInvoicePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const clientsQuery = useQuery({ queryKey: ["clients-picker"], queryFn: () => listClients({ pageSize: 200 }) });
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceCreateFormValues>({ resolver: zodResolver(invoiceCreateSchema) });

  async function submit(values: InvoiceCreateFormValues) {
    setFormError(null);
    try {
      const invoice = await createInvoice({
        client_id: values.client_id,
        issue_date: values.issue_date || undefined,
        due_date: values.due_date || undefined,
        po_number: values.po_number || "",
      });
      await queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
      router.push(`/invoices/${invoice.id}`);
    } catch (error) {
      const matched = applyFieldErrors(setError, error, FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-3xl text-cadence-ink">New invoice</h1>
      <form onSubmit={handleSubmit(submit)} noValidate className="flex max-w-xl flex-col gap-4">
        <Field label="Client" htmlFor="client_id" error={errors.client_id?.message}>
          <Select id="client_id" {...register("client_id")}>
            <option value="">Select…</option>
            {clientsQuery.data?.results.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Issue date" htmlFor="issue_date" error={errors.issue_date?.message} hint="Defaults to today">
            <Input id="issue_date" type="date" {...register("issue_date")} />
          </Field>
          <Field label="Due date" htmlFor="due_date" error={errors.due_date?.message} hint="Defaults to client terms">
            <Input id="due_date" type="date" {...register("due_date")} />
          </Field>
        </div>
        <Field label="PO number" htmlFor="po_number" error={errors.po_number?.message}>
          <Input id="po_number" {...register("po_number")} />
        </Field>
        {formError ? <p className="font-body text-sm text-cadence-red">{formError}</p> : null}
        <Button type="submit" disabled={isSubmitting} className="self-start">
          {isSubmitting ? "Creating…" : "Create invoice"}
        </Button>
      </form>
    </div>
  );
}
