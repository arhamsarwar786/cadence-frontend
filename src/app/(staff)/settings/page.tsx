"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useSession } from "@/auth/session-context";
import {
  getOrgSettings,
  orgKeys,
  setConsentText,
  setOrgLogo,
  updateOrgSettings,
  uploadLogo,
  type OrgSettingsPatch,
} from "@/features/orgs/api";
import { hasAnyPerm } from "@/permissions/has-perm";
import { PERM } from "@/permissions/keys";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import { Button, Field, Input, Select, Textarea } from "@/shared/ui";

const PROVINCES = [
  "AB",
  "BC",
  "MB",
  "NB",
  "NL",
  "NS",
  "NT",
  "NU",
  "ON",
  "PE",
  "QC",
  "SK",
  "YT",
] as const;

/** Common Canadian IANA zones — free-typed values still go to the API (a typo is a 400). */
const TIMEZONES = [
  "America/St_Johns",
  "America/Halifax",
  "America/Toronto",
  "America/Winnipeg",
  "America/Regina",
  "America/Edmonton",
  "America/Vancouver",
  "America/Whitehorse",
  "America/Yellowknife",
  "America/Iqaluit",
] as const;

const settingsSchema = z.object({
  name: z.string().min(1, "Name is required."),
  legal_name: z.string(),
  address_line_1: z.string(),
  address_line_2: z.string(),
  city: z.string(),
  province: z.enum(PROVINCES),
  postal_code: z.string(),
  email: z.string(),
  phone: z.string(),
  tax_id: z.string(),
  remit_to_details: z.string(),
  timezone: z.string().min(1, "Timezone is required."),
  auto_approve_onboarding: z.boolean(),
  retention_years: z.number({ error: "Enter a whole number of years." }).int(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;
const FIELD_NAMES = Object.keys(settingsSchema.shape);

export default function SettingsPage() {
  const { session, refresh } = useSession();
  const queryClient = useQueryClient();
  const canView =
    Boolean(session?.user.is_root) ||
    (session ? hasAnyPerm(session.user, [PERM.ADMIN_ORG_VIEW]) : false);
  const canManage =
    Boolean(session?.user.is_root) ||
    (session ? hasAnyPerm(session.user, [PERM.ADMIN_ORG_MANAGE]) : false);
  const isRoot = Boolean(session?.user.is_root);

  const orgQuery = useQuery({
    queryKey: orgKeys.settings,
    queryFn: getOrgSettings,
    enabled: canView,
  });

  const [uploading, setUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [consentDraft, setConsentDraft] = useState(session?.organization.consent_text ?? "");
  const [savingConsent, setSavingConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [consentSaved, setConsentSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SettingsFormValues>({ resolver: zodResolver(settingsSchema) });

  useEffect(() => {
    if (!orgQuery.data) return;
    const o = orgQuery.data;
    reset({
      name: o.name,
      legal_name: o.legal_name ?? "",
      address_line_1: o.address_line_1 ?? "",
      address_line_2: o.address_line_2 ?? "",
      city: o.city ?? "",
      province: (o.province as (typeof PROVINCES)[number]) || "ON",
      postal_code: o.postal_code ?? "",
      email: o.email ?? "",
      phone: o.phone ?? "",
      tax_id: o.tax_id ?? "",
      remit_to_details: o.remit_to_details ?? "",
      timezone: o.timezone,
      auto_approve_onboarding: o.auto_approve_onboarding,
      retention_years: o.retention_years,
    });
  }, [orgQuery.data, reset]);

  useEffect(() => {
    if (session?.organization.consent_text != null) {
      setConsentDraft(session.organization.consent_text);
    }
  }, [session?.organization.consent_text]);

  if (session && !canView) {
    return (
      <div>
        <h1 className="font-heading text-3xl text-cadence-ink">Settings</h1>
        <p className="mt-2 font-body text-sm text-cadence-ink/70">
          You need the admin.org.view permission to open organization settings.
        </p>
      </div>
    );
  }

  async function handleLogo(file: File) {
    setUploading(true);
    setLogoError(null);
    try {
      const doc = await uploadLogo(file);
      await setOrgLogo(doc.id);
      await queryClient.invalidateQueries({ queryKey: orgKeys.settings });
    } catch (error) {
      setLogoError(messageFrom(error));
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveConsent() {
    setSavingConsent(true);
    setConsentError(null);
    setConsentSaved(false);
    try {
      await setConsentText(consentDraft);
      await refresh();
      setConsentSaved(true);
    } catch (error) {
      setConsentError(messageFrom(error));
    } finally {
      setSavingConsent(false);
    }
  }

  async function onSave(values: SettingsFormValues) {
    setSaveError(null);
    setSaved(false);
    // Only writable keys — never send read-only formats/country/logo.
    const body: OrgSettingsPatch = {
      name: values.name,
      legal_name: values.legal_name,
      address_line_1: values.address_line_1,
      address_line_2: values.address_line_2,
      city: values.city,
      province: values.province,
      postal_code: values.postal_code,
      email: values.email,
      phone: values.phone,
      tax_id: values.tax_id,
      remit_to_details: values.remit_to_details,
      timezone: values.timezone,
      auto_approve_onboarding: values.auto_approve_onboarding,
      retention_years: values.retention_years,
    };
    try {
      const updated = await updateOrgSettings(body);
      queryClient.setQueryData(orgKeys.settings, updated);
      await refresh();
      setSaved(true);
    } catch (error) {
      const banner = applyFieldErrors(setError, error, FIELD_NAMES);
      if (banner) setSaveError(banner);
      // Never imply success when retention/timezone/etc. were refused.
    }
  }

  const org = orgQuery.data;
  const timezoneOptions = Array.from(
    new Set([...TIMEZONES, ...(org?.timezone ? [org.timezone] : [])]),
  );

  return (
    <div className="flex max-w-2xl flex-col gap-10">
      <div>
        <h1 className="font-heading text-3xl text-cadence-ink">Settings</h1>
        <p className="mt-2 font-body text-sm text-cadence-ink/65">
          Agency address, clock, remittance, and onboarding mode. Number formats and country are
          fixed here — contact support to change them.
        </p>
      </div>

      {orgQuery.isLoading ? (
        <p className="font-body text-sm text-cadence-ink/60">Loading…</p>
      ) : orgQuery.isError ? (
        <p className="font-body text-sm text-cadence-red">{messageFrom(orgQuery.error)}</p>
      ) : org ? (
        <form onSubmit={handleSubmit(onSave)} noValidate className="flex flex-col gap-8">
          <section className="flex flex-col gap-3">
            <h2 className="font-subheading text-xl text-cadence-ink">Identity</h2>
            <Field label="Display name" htmlFor="org-name" error={errors.name?.message}>
              <Input id="org-name" disabled={!canManage} {...register("name")} />
            </Field>
            <Field label="Legal name" htmlFor="org-legal" error={errors.legal_name?.message}>
              <Input id="org-legal" disabled={!canManage} {...register("legal_name")} />
            </Field>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-subheading text-xl text-cadence-ink">Address</h2>
            <Field label="Address line 1" htmlFor="org-a1" error={errors.address_line_1?.message}>
              <Input id="org-a1" disabled={!canManage} {...register("address_line_1")} />
            </Field>
            <Field label="Address line 2" htmlFor="org-a2" error={errors.address_line_2?.message}>
              <Input id="org-a2" disabled={!canManage} {...register("address_line_2")} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="City" htmlFor="org-city" error={errors.city?.message}>
                <Input id="org-city" disabled={!canManage} {...register("city")} />
              </Field>
              <Field
                label="Province / territory"
                htmlFor="org-province"
                error={errors.province?.message}
                hint="Printed on invoices and e-sign docs — not used for tax."
              >
                <Select id="org-province" disabled={!canManage} {...register("province")}>
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Postal code" htmlFor="org-postal" error={errors.postal_code?.message}>
                <Input id="org-postal" disabled={!canManage} {...register("postal_code")} />
              </Field>
              <Field label="Country" htmlFor="org-country" hint="Read-only">
                <Input id="org-country" value={org.country} disabled readOnly />
              </Field>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-subheading text-xl text-cadence-ink">Contact</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Email" htmlFor="org-email" error={errors.email?.message}>
                <Input id="org-email" type="email" disabled={!canManage} {...register("email")} />
              </Field>
              <Field label="Phone" htmlFor="org-phone" error={errors.phone?.message}>
                <Input id="org-phone" disabled={!canManage} {...register("phone")} />
              </Field>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-subheading text-xl text-cadence-ink">Billing & remittance</h2>
            <Field label="Tax ID" htmlFor="org-tax" error={errors.tax_id?.message}>
              <Input id="org-tax" disabled={!canManage} {...register("tax_id")} />
            </Field>
            <Field
              label="Remit-to details"
              htmlFor="org-remit"
              error={errors.remit_to_details?.message}
              hint="Shown on invoices as where to send payment."
            >
              <Textarea id="org-remit" rows={3} disabled={!canManage} {...register("remit_to_details")} />
            </Field>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-subheading text-xl text-cadence-ink">Clock & retention</h2>
            <Field
              label="Timezone"
              htmlFor="org-tz"
              error={errors.timezone?.message}
              hint="IANA name (e.g. America/Toronto). Shift times and due dates use this zone."
            >
              <Select id="org-tz" disabled={!canManage} {...register("timezone")}>
                {timezoneOptions.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Retention years"
              htmlFor="org-retention"
              error={errors.retention_years?.message}
              hint="Floor is 7 years. A lower value is refused — nothing is saved."
            >
              <Input
                id="org-retention"
                type="number"
                step={1}
                disabled={!canManage}
                {...register("retention_years", { valueAsNumber: true })}
              />
            </Field>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-subheading text-xl text-cadence-ink">Onboarding</h2>
            <label className="flex items-start gap-3 font-body text-sm text-cadence-ink">
              <input
                type="checkbox"
                className="mt-1"
                disabled={!canManage}
                {...register("auto_approve_onboarding")}
              />
              <span>
                <span className="font-medium">Auto-approve completed onboarding</span>
                <span className="mt-1 block text-cadence-ink/60">
                  When on, a finished submission enters the workforce without a staff click. Missing
                  required paperwork (résumé, SIN document, two photo IDs, and a permit when needed)
                  is still refused either way.
                </span>
              </span>
            </label>
          </section>

          <section className="flex flex-col gap-2 rounded-[1.5rem] bg-surface-muted/60 p-5">
            <h2 className="font-subheading text-lg text-cadence-ink">Document numbers (read-only)</h2>
            <dl className="grid gap-2 font-body text-sm sm:grid-cols-2">
              <div>
                <dt className="text-cadence-ink/55">Invoice format</dt>
                <dd className="font-medium">{org.invoice_number_format}</dd>
              </div>
              <div>
                <dt className="text-cadence-ink/55">Credit note format</dt>
                <dd className="font-medium">{org.credit_note_number_format}</dd>
              </div>
              <div>
                <dt className="text-cadence-ink/55">Logo document</dt>
                <dd className="font-medium">{org.logo_document_id ?? "None"}</dd>
              </div>
            </dl>
          </section>

          {canManage ? (
            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={isSubmitting || !isDirty} className="self-start">
                {isSubmitting ? "Saving…" : "Save settings"}
              </Button>
              {saved ? <p className="font-body text-xs text-emerald-700">Saved.</p> : null}
              {saveError ? <p className="font-body text-xs text-cadence-red">{saveError}</p> : null}
            </div>
          ) : (
            <p className="font-body text-sm text-cadence-ink/60">
              View only — you need admin.org.manage to change these fields.
            </p>
          )}
        </form>
      ) : null}

      {isRoot ? (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="font-subheading text-xl text-cadence-ink">Organization logo</h2>
            <p className="font-body text-xs text-cadence-ink/60">Root only — separate from settings above.</p>
            <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-full bg-cadence-yellow px-3 py-1.5 font-body text-sm text-cadence-ink">
              {uploading ? "Uploading…" : "Upload logo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleLogo(file);
                  e.target.value = "";
                }}
              />
            </label>
            {logoError ? <p className="font-body text-xs text-cadence-red">{logoError}</p> : null}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-subheading text-xl text-cadence-ink">Consent text</h2>
            <p className="font-body text-xs text-cadence-ink/60">
              Root only. Current version: {session?.organization.consent_version ?? 0}. Saving bumps
              the version — a worker&apos;s past consent to an earlier version is never
              retroactively invalidated.
            </p>
            <textarea
              rows={6}
              value={consentDraft}
              onChange={(e) => setConsentDraft(e.target.value)}
              className="w-full rounded-2xl border border-cadence-ink/10 bg-surface px-3 py-2 font-body text-sm text-cadence-ink"
            />
            <Button onClick={handleSaveConsent} disabled={savingConsent} className="self-start">
              {savingConsent ? "Saving…" : "Save consent text"}
            </Button>
            {consentSaved ? <p className="font-body text-xs text-emerald-700">Saved.</p> : null}
            {consentError ? <p className="font-body text-xs text-cadence-red">{consentError}</p> : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
