"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { workerProfileSchema, type WorkerProfileFormValues } from "@/features/workers/schemas";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import { PROVINCE_LABELS, PROVINCES } from "@/features/clients/schemas";
import { Button, Field, Input, Select } from "@/shared/ui";

const FIELD_NAMES = Object.keys(workerProfileSchema.shape);

export interface WorkerProfileFormProps {
  defaultValues?: Partial<WorkerProfileFormValues>;
  onSubmit: (values: WorkerProfileFormValues) => Promise<void>;
  submitLabel?: string;
}

export function WorkerProfileForm({
  defaultValues,
  onSubmit,
  submitLabel = "Save",
}: WorkerProfileFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<WorkerProfileFormValues>({
    resolver: zodResolver(workerProfileSchema),
    defaultValues,
  });

  async function submit(values: WorkerProfileFormValues) {
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
      <div className="grid grid-cols-2 gap-4">
        <Field label="First name" htmlFor="first_name" error={errors.first_name?.message}>
          <Input id="first_name" {...register("first_name")} />
        </Field>
        <Field label="Last name" htmlFor="last_name" error={errors.last_name?.message}>
          <Input id="last_name" {...register("last_name")} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" {...register("email")} />
        </Field>
        <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
          <Input id="phone" {...register("phone")} />
        </Field>
      </div>
      <Field label="Pronouns" htmlFor="pronouns" error={errors.pronouns?.message}>
        <Input id="pronouns" {...register("pronouns")} />
      </Field>
      <Field label="Address line 1" htmlFor="address_line_1" error={errors.address_line_1?.message}>
        <Input id="address_line_1" {...register("address_line_1")} />
      </Field>
      <Field label="Address line 2" htmlFor="address_line_2" error={errors.address_line_2?.message}>
        <Input id="address_line_2" {...register("address_line_2")} />
      </Field>
      <div className="grid grid-cols-3 gap-4">
        <Field label="City" htmlFor="city" error={errors.city?.message}>
          <Input id="city" {...register("city")} />
        </Field>
        <Field label="Province" htmlFor="province" error={errors.province?.message}>
          <Select id="province" {...register("province")}>
            <option value="">—</option>
            {PROVINCES.map((p) => (
              <option key={p} value={p}>
                {PROVINCE_LABELS[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Postal code" htmlFor="postal_code" error={errors.postal_code?.message}>
          <Input id="postal_code" {...register("postal_code")} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Emergency contact"
          htmlFor="emergency_contact_name"
          error={errors.emergency_contact_name?.message}
        >
          <Input id="emergency_contact_name" {...register("emergency_contact_name")} />
        </Field>
        <Field
          label="Emergency phone"
          htmlFor="emergency_contact_phone"
          error={errors.emergency_contact_phone?.message}
        >
          <Input id="emergency_contact_phone" {...register("emergency_contact_phone")} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Employment type" htmlFor="employment_type" error={errors.employment_type?.message}>
          <Select id="employment_type" {...register("employment_type")}>
            <option value="">—</option>
            <option value="full_time">Full-time</option>
            <option value="part_time">Part-time</option>
            <option value="either">Either</option>
          </Select>
        </Field>
        <Field
          label="Work authorization"
          htmlFor="work_authorization"
          error={errors.work_authorization?.message}
        >
          <Select id="work_authorization" {...register("work_authorization")}>
            <option value="">—</option>
            <option value="citizen_pr">Citizen / PR</option>
            <option value="permit">Work or study permit</option>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Work status" htmlFor="work_status" error={errors.work_status?.message}>
          <Select id="work_status" {...register("work_status")}>
            <option value="">—</option>
            <option value="available">Available</option>
            <option value="on_shift">On shift</option>
            <option value="on_leave">On leave</option>
          </Select>
        </Field>
        <Field label="Pay method" htmlFor="pay_method" error={errors.pay_method?.message}>
          <Select id="pay_method" {...register("pay_method")}>
            <option value="">—</option>
            <option value="etransfer">e-Transfer</option>
            <option value="direct_deposit">Direct deposit</option>
            <option value="cheque">Cheque</option>
          </Select>
        </Field>
      </div>
      <Field
        label="Notification channel"
        htmlFor="notification_channel"
        error={errors.notification_channel?.message}
      >
        <Select id="notification_channel" {...register("notification_channel")}>
          <option value="email">Email</option>
          <option value="sms">SMS</option>
        </Select>
      </Field>
      <Field label="Referral source" htmlFor="referral_source" error={errors.referral_source?.message}>
        <Input id="referral_source" {...register("referral_source")} />
      </Field>
      {formError ? <p className="font-body text-sm text-cadence-red">{formError}</p> : null}
      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
