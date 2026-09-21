"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  clientBillingSchema,
  type ClientBillingFormValues,
} from "@/features/clients/schemas";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import { Button, Field, Input, Select } from "@/shared/ui";

const FIELD_NAMES = Object.keys(clientBillingSchema.shape);

export interface ClientBillingFormProps {
  defaultValues?: Partial<ClientBillingFormValues>;
  onSubmit: (values: ClientBillingFormValues) => Promise<void>;
}

export function ClientBillingForm({ defaultValues, onSubmit }: ClientBillingFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ClientBillingFormValues>({
    resolver: zodResolver(clientBillingSchema),
    defaultValues,
  });

  async function submit(values: ClientBillingFormValues) {
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
      <Field label="Company name" htmlFor="company_name" error={errors.company_name?.message}>
        <Input id="company_name" {...register("company_name")} />
      </Field>
      <Field label="Billing email" htmlFor="billing_email" error={errors.billing_email?.message}>
        <Input id="billing_email" type="email" {...register("billing_email")} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Tax ID" htmlFor="tax_id" error={errors.tax_id?.message}>
          <Input id="tax_id" {...register("tax_id")} />
        </Field>
        <Field
          label="Payment terms"
          htmlFor="payment_terms"
          error={errors.payment_terms?.message}
        >
          <Select id="payment_terms" {...register("payment_terms")}>
            <option value="">—</option>
            <option value="due_on_receipt">Due on receipt</option>
            <option value="net_15">Net 15</option>
            <option value="net_30">Net 30</option>
            <option value="net_60">Net 60</option>
          </Select>
        </Field>
      </div>
      <label className="flex items-center gap-2 font-body text-sm text-cadence-ink">
        <input type="checkbox" {...register("po_required")} />
        PO required
      </label>
      {formError ? <p className="font-body text-sm text-cadence-red">{formError}</p> : null}
      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? "Saving…" : "Save billing"}
      </Button>
    </form>
  );
}
