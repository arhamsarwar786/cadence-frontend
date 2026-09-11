"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { updateMe } from "@/features/portal/actions";
import { getMe, getPersonal } from "@/features/portal/api";
import { CertsPanel } from "@/features/portal/components/CertsPanel";
import { EducationPanel, EmploymentHistoryPanel, SkillsPanel } from "@/features/portal/components/SimplePanels";
import { portalProfileSchema, type PortalProfileFormValues } from "@/features/portal/schemas";
import { PROVINCE_LABELS, PROVINCES } from "@/features/clients/schemas";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import { Button, Field, Input, Select } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";

const TABS = ["Profile", "Personal", "Certs", "Skills", "Education", "Employment history"] as const;
type Tab = (typeof TABS)[number];
const ME_KEY = ["portal", "me"] as const;
const FIELD_NAMES = Object.keys(portalProfileSchema.shape);

export default function PortalMePage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("Profile");
  const [editing, setEditing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const meQuery = useQuery({ queryKey: ME_KEY, queryFn: getMe });
  const personalQuery = useQuery({ queryKey: ["portal", "personal"], queryFn: getPersonal, enabled: tab === "Personal" });

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PortalProfileFormValues>({ resolver: zodResolver(portalProfileSchema) });

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
        // No BlankEnum on these two — "" isn't accepted, only a real
        // value or null.
        employment_type: values.employment_type || null,
        work_authorization: values.work_authorization || null,
      });
      await queryClient.invalidateQueries({ queryKey: ME_KEY });
      setEditing(false);
    } catch (error) {
      const matched = applyFieldErrors(setError, error, FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
    }
  }

  const me = meQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-3xl text-cadence-ink">
        {me ? `${me.first_name} ${me.last_name}` : "My profile"}
      </h1>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-t-md px-3 py-2 font-body text-sm",
              tab === t ? "border-b-2 border-cadence-red text-cadence-ink" : "text-cadence-ink/60 hover:text-cadence-ink",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Profile" && me ? (
        editing ? (
          <form onSubmit={handleSubmit(submit)} noValidate className="flex max-w-xl flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Email" htmlFor="p-email" error={errors.email?.message}>
                <Input id="p-email" type="email" defaultValue={me.email ?? ""} {...register("email")} />
              </Field>
              <Field label="Phone" htmlFor="p-phone" error={errors.phone?.message}>
                <Input id="p-phone" defaultValue={me.phone ?? ""} {...register("phone")} />
              </Field>
            </div>
            <Field label="Address line 1" htmlFor="p-addr1" error={errors.address_line_1?.message}>
              <Input id="p-addr1" defaultValue={me.address_line_1 ?? ""} {...register("address_line_1")} />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="City" htmlFor="p-city" error={errors.city?.message}>
                <Input id="p-city" defaultValue={me.city ?? ""} {...register("city")} />
              </Field>
              <Field label="Province" htmlFor="p-province" error={errors.province?.message}>
                <Select id="p-province" defaultValue={me.province ?? ""} {...register("province")}>
                  <option value="">—</option>
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {PROVINCE_LABELS[p]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Postal code" htmlFor="p-postal" error={errors.postal_code?.message}>
                <Input id="p-postal" defaultValue={me.postal_code ?? ""} {...register("postal_code")} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Emergency contact" htmlFor="p-ec-name" error={errors.emergency_contact_name?.message}>
                <Input id="p-ec-name" defaultValue={me.emergency_contact_name ?? ""} {...register("emergency_contact_name")} />
              </Field>
              <Field label="Emergency phone" htmlFor="p-ec-phone" error={errors.emergency_contact_phone?.message}>
                <Input id="p-ec-phone" defaultValue={me.emergency_contact_phone ?? ""} {...register("emergency_contact_phone")} />
              </Field>
            </div>
            <Field label="Notification channel" htmlFor="p-notif" error={errors.notification_channel?.message}>
              <Select id="p-notif" defaultValue={me.notification_channel} {...register("notification_channel")}>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </Select>
            </Field>
            {formError ? <p className="font-body text-sm text-cadence-red">{formError}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <Button size="sm" variant="secondary" className="self-start" onClick={() => setEditing(true)}>
              Edit profile
            </Button>
            <dl className="grid max-w-xl grid-cols-2 gap-x-8 gap-y-3 font-body text-sm">
              <div>
                <dt className="text-cadence-ink/60">Email</dt>
                <dd className="text-cadence-ink">{me.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-cadence-ink/60">Phone</dt>
                <dd className="text-cadence-ink">{me.phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-cadence-ink/60">Address</dt>
                <dd className="text-cadence-ink">
                  {[me.address_line_1, me.city, me.province, me.postal_code].filter(Boolean).join(", ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-cadence-ink/60">Emergency contact</dt>
                <dd className="text-cadence-ink">
                  {[me.emergency_contact_name, me.emergency_contact_phone].filter(Boolean).join(" · ") || "—"}
                </dd>
              </div>
            </dl>
          </div>
        )
      ) : null}

      {tab === "Personal" ? (
        <dl className="grid max-w-sm grid-cols-2 gap-x-8 gap-y-3 font-body text-sm">
          <div>
            <dt className="text-cadence-ink/60">SIN</dt>
            <dd className="text-cadence-ink">{personalQuery.data?.sin_last4 ?? "Not on file"}</dd>
          </div>
          <div>
            <dt className="text-cadence-ink/60">Date of birth</dt>
            <dd className="text-cadence-ink">{personalQuery.data?.dob_year ?? "Not on file"}</dd>
          </div>
          <div>
            <dt className="text-cadence-ink/60">Bank account</dt>
            <dd className="text-cadence-ink">{personalQuery.data?.bank_account_last4 ?? "Not on file"}</dd>
          </div>
        </dl>
      ) : null}

      {tab === "Certs" ? <CertsPanel /> : null}
      {tab === "Skills" ? <SkillsPanel /> : null}
      {tab === "Education" ? <EducationPanel /> : null}
      {tab === "Employment history" ? <EmploymentHistoryPanel /> : null}
    </div>
  );
}
