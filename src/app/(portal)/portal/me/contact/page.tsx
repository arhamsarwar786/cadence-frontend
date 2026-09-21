"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { updateMe } from "@/features/portal/actions";
import { getMe } from "@/features/portal/api";
import { portalProfileSchema, type PortalProfileFormValues } from "@/features/portal/schemas";
import { PROVINCE_LABELS, PROVINCES } from "@/features/clients/schemas";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import { Button, Field, Input, Select } from "@/shared/ui";
import { PortalCard, PortalFrame } from "../../../_components/PortalFrame";

const ME_KEY = ["portal", "me"] as const;
const FIELD_NAMES = Object.keys(portalProfileSchema.shape);

export default function PortalContactPage() {
  const queryClient = useQueryClient();
  const meQuery = useQuery({ queryKey: ME_KEY, queryFn: getMe });
  const [formError, setFormError] = useState<string | null>(null);
  const me = meQuery.data;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PortalProfileFormValues>({
    resolver: zodResolver(portalProfileSchema),
    values: me
      ? {
          email: me.email ?? "",
          phone: me.phone ?? "",
          address_line_1: me.address_line_1 ?? "",
          address_line_2: me.address_line_2 ?? "",
          city: me.city ?? "",
          province: (me.province as PortalProfileFormValues["province"]) ?? "",
          postal_code: me.postal_code ?? "",
          emergency_contact_name: me.emergency_contact_name ?? "",
          emergency_contact_phone: me.emergency_contact_phone ?? "",
          notification_channel: me.notification_channel,
          employment_type: (me.employment_type as PortalProfileFormValues["employment_type"]) ?? "",
          work_authorization:
            (me.work_authorization as PortalProfileFormValues["work_authorization"]) ?? "",
          referral_source: me.referral_source ?? "",
        }
      : undefined,
  });

  async function submit(values: PortalProfileFormValues) {
    setFormError(null);
    try {
      await updateMe({
        ...values,
        email: values.email || undefined,
        phone: values.phone || undefined,
        address_line_1: values.address_line_1 || undefined,
        address_line_2: values.address_line_2 || undefined,
        city: values.city || undefined,
        postal_code: values.postal_code || undefined,
        emergency_contact_name: values.emergency_contact_name || undefined,
        emergency_contact_phone: values.emergency_contact_phone || undefined,
        referral_source: values.referral_source || undefined,
        employment_type: values.employment_type || null,
        work_authorization: values.work_authorization || null,
      });
      await queryClient.invalidateQueries({ queryKey: ME_KEY });
    } catch (error) {
      const banner = applyFieldErrors(setError, error, FIELD_NAMES);
      if (banner) setFormError(banner);
    }
  }

  return (
    <PortalFrame title="Contact information" subtitle="Keep your details current for shift offers.">
      <Link href="/portal/me" className="mb-4 inline-block text-sm underline">
        ← My profile
      </Link>
      <PortalCard>
        <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input id="email" {...register("email")} />
          </Field>
          <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" {...register("phone")} />
          </Field>
          <Field label="Home address" htmlFor="address_line_1" error={errors.address_line_1?.message}>
            <Input id="address_line_1" {...register("address_line_1")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>
          <Field label="Postal code" htmlFor="postal_code" error={errors.postal_code?.message}>
            <Input id="postal_code" {...register("postal_code")} />
          </Field>
          <Field
            label="Emergency contact name"
            htmlFor="emergency_contact_name"
            error={errors.emergency_contact_name?.message}
          >
            <Input id="emergency_contact_name" {...register("emergency_contact_name")} />
          </Field>
          <Field
            label="Emergency contact phone"
            htmlFor="emergency_contact_phone"
            error={errors.emergency_contact_phone?.message}
          >
            <Input id="emergency_contact_phone" {...register("emergency_contact_phone")} />
          </Field>
          <Field label="Notify me by" htmlFor="notification_channel">
            <Select id="notification_channel" {...register("notification_channel")}>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="in_app">In app</option>
            </Select>
          </Field>
          {formError ? <p className="text-sm text-cadence-red">{formError}</p> : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </PortalCard>
    </PortalFrame>
  );
}
