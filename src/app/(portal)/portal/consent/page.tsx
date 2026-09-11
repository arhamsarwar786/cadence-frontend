"use client";

import { useState } from "react";
import { useSession } from "@/auth/session-context";
import { captureConsent } from "@/features/portal/actions";
import { messageFrom } from "@/shared/lib/errors";
import { Button } from "@/shared/ui";

export default function ConsentPage() {
  const { session } = useSession();
  const [captured, setCaptured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const consentText = session?.organization.consent_text ?? "";
  const consentVersion = session?.organization.consent_version ?? 0;

  async function handleAgree() {
    setSubmitting(true);
    setError(null);
    try {
      await captureConsent();
      setCaptured(true);
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="font-heading text-3xl text-cadence-ink">Consent</h1>

      {consentVersion === 0 ? (
        <p className="font-body text-sm text-cadence-ink/70">
          Your agency hasn&apos;t set up a consent notice yet — there&apos;s nothing to agree to
          right now.
        </p>
      ) : (
        <>
          <div className="whitespace-pre-wrap rounded-lg border border-border bg-surface-muted p-4 font-body text-sm text-cadence-ink">
            {consentText}
          </div>
          <p className="font-body text-xs text-cadence-ink/60">Version {consentVersion}</p>
          <Button onClick={handleAgree} disabled={submitting || captured} className="self-start">
            {captured ? "Consent recorded" : submitting ? "Recording…" : "I agree"}
          </Button>
          {error ? <p className="font-body text-sm text-cadence-red">{error}</p> : null}
        </>
      )}
    </div>
  );
}
