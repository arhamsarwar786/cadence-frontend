"use client";

import { useState } from "react";
import { useSession } from "@/auth/session-context";
import { setConsentText, setOrgLogo, uploadLogo } from "@/features/orgs/api";
import { messageFrom } from "@/shared/lib/errors";
import { Button } from "@/shared/ui";

export default function SettingsPage() {
  const { session, refresh } = useSession();
  const [uploading, setUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [consentDraft, setConsentDraft] = useState(session?.organization.consent_text ?? "");
  const [savingConsent, setSavingConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [consentSaved, setConsentSaved] = useState(false);

  if (session && !session.user.is_root) {
    return (
      <div>
        <h1 className="font-heading text-3xl text-cadence-ink">Settings</h1>
        <p className="mt-2 font-body text-sm text-cadence-ink/70">Root access only.</p>
      </div>
    );
  }

  async function handleLogo(file: File) {
    setUploading(true);
    setLogoError(null);
    try {
      const doc = await uploadLogo(file);
      await setOrgLogo(doc.id);
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

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <h1 className="font-heading text-3xl text-cadence-ink">Settings</h1>

      <section className="flex flex-col gap-2">
        <h2 className="font-subheading text-xl text-cadence-ink">Organization logo</h2>
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
          Current version: {session?.organization.consent_version ?? 0}. Saving bumps the version —
          a worker&apos;s past consent to an earlier version is never retroactively invalidated.
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

      <section className="flex flex-col gap-2 rounded-[1.5rem] bg-surface p-5">
        <h2 className="font-subheading text-xl text-cadence-ink">Office access (not in this app yet)</h2>
        <p className="font-body text-sm text-cadence-ink/70">
          Staff logins, the audit log, and reporting have catalog keys but no API door in this
          build. Until those screens exist, create and deactivate staff in Django admin, keep an
          ops runbook for who holds root, and treat server logs as the audit trail.
        </p>
        <p className="font-body text-sm text-cadence-ink/70">
          Credential resets are the same path: a root user (or Django admin) resets the account.
          There is no self-serve forgot-password on the shared login page.
        </p>
      </section>
    </div>
  );
}
