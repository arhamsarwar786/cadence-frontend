"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { getConsentText } from "@/features/portal/api";
import { captureConsent } from "@/features/portal/actions";
import { messageFrom } from "@/shared/lib/errors";
import { Button } from "@/shared/ui";
import { PortalCard, PortalFrame } from "../../_components/PortalFrame";

/**
 * Re-consent only — first capture lives in onboarding. Not listed in portal More.
 */
export default function ConsentPage() {
  const consentQuery = useQuery({ queryKey: ["portal", "consent-text"], queryFn: getConsentText });
  const [captured, setCaptured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const consentText = consentQuery.data?.consent_text ?? "";
  const consentVersion = consentQuery.data?.consent_version ?? 0;

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
    <PortalFrame
      title="Consent"
      subtitle="First consent happens in onboarding. Use this page only when your agency updates its privacy notice."
    >
      <p className="mb-4 font-body text-sm text-cadence-ink/60">
        New here?{" "}
        <Link href="/portal/onboarding?step=consent" className="underline">
          Continue onboarding
        </Link>
      </p>
      {consentQuery.isError ? (
        <p className="font-body text-sm text-cadence-red">{messageFrom(consentQuery.error)}</p>
      ) : consentVersion === 0 ? (
        <PortalCard>
          <p className="font-body text-sm text-cadence-ink/70">
            Your agency has not published a consent notice yet. Check back after they set one.
          </p>
        </PortalCard>
      ) : captured ? (
        <PortalCard>
          <p className="font-body text-sm text-cadence-ink">Consent recorded for version {consentVersion}.</p>
        </PortalCard>
      ) : (
        <PortalCard className="flex flex-col gap-4">
          <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl bg-surface p-4 font-body text-sm text-cadence-ink/80">
            {consentText || "Loading…"}
          </div>
          {error ? <p className="font-body text-sm text-cadence-red">{error}</p> : null}
          <Button onClick={handleAgree} disabled={submitting || !consentText}>
            {submitting ? "Saving…" : "I agree"}
          </Button>
        </PortalCard>
      )}
    </PortalFrame>
  );
}
