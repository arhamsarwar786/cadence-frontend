"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import {
  clientCreateSchema,
  clientSchema,
  PROVINCE_LABELS,
  PROVINCES,
  type ClientFormValues,
} from "@/features/clients/schemas";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import { Button, Field, Input, Select } from "@/shared/ui";

const FIELD_NAMES = Object.keys(clientSchema.shape);

export interface ClientFormProps {
  defaultValues?: Partial<ClientFormValues>;
  onSubmit: (values: ClientFormValues) => Promise<void>;
  submitLabel?: string;
  /** /clients/new sets this (markup_pct required); the detail page's edit
   * mode leaves it false — a PATCH, and a scoped user without
   * clients.markup.view never sees this field to begin with. */
  requireMarkup?: boolean;
}

/** Shared by /clients/new and the detail page's edit mode — one form, one
 * validation source of truth (ARCHITECTURE.md §0: Zod client-side, the
 * server stays the real gate). */
export function ClientForm({
  defaultValues,
  onSubmit,
  submitLabel = "Save",
  requireMarkup = false,
}: ClientFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormValues>({
    // clientCreateSchema only narrows markup_pct to required; both
    // resolvers validate the same ClientFormValues shape otherwise, so
    // this cast is just working around zodResolver's Resolver<T>
    // contravariance, not papering over a real type mismatch.
    resolver: (requireMarkup
      ? zodResolver(clientCreateSchema)
      : zodResolver(clientSchema)) as Resolver<ClientFormValues>,
    defaultValues: { status: "prospect", ...defaultValues },
  });

  async function submit(values: ClientFormValues) {
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      const matched = applyFieldErrors(setError, error, FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="flex max-w-xl flex-col gap-4">
      <Field label="Name" htmlFor="name" error={errors.name?.message}>
        <Input id="name" {...register("name")} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Status" htmlFor="status" error={errors.status?.message}>
          <Select id="status" {...register("status")}>
            <option value="prospect">Prospect</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </Field>
        <Field
          label="Markup %"
          htmlFor="markup_pct"
          error={errors.markup_pct?.message}
          hint="e.g. 35.00"
        >
          <Input id="markup_pct" {...register("markup_pct")} />
        </Field>
      </div>
      <Field
        label="Address line 1"
        htmlFor="address_line_1"
        error={errors.address_line_1?.message}
      >
        <Input id="address_line_1" {...register("address_line_1")} />
      </Field>
      <Field
        label="Address line 2"
        htmlFor="address_line_2"
        error={errors.address_line_2?.message}
      >
        <Input id="address_line_2" {...register("address_line_2")} />
      </Field>
      <div className="grid grid-cols-3 gap-4">
        <Field label="City" htmlFor="city" error={errors.city?.message}>
          <Input id="city" {...register("city")} />
        </Field>
        <Field label="Province" htmlFor="province" error={errors.province?.message}>
          <Select id="province" {...register("province")}>
            {PROVINCES.map((p) => (
              <option key={p} value={p}>
                {PROVINCE_LABELS[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Postal code" htmlFor="postal_code" error={errors.postal_code?.message}>
          <Input id="postal_code" {...register("postal_code")} placeholder="A1A 1A1" />
        </Field>
      </div>
      <Field label="Billing cycle" htmlFor="billing_cycle" error={errors.billing_cycle?.message}>
        <Select id="billing_cycle" {...register("billing_cycle")}>
          <option value="">—</option>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Biweekly</option>
          <option value="monthly">Monthly</option>
        </Select>
      </Field>
      {formError ? <p className="font-body text-sm text-cadence-red">{formError}</p> : null}
      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
