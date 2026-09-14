"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getConsentText } from "@/features/portal/api";
import { captureConsent } from "@/features/portal/actions";
import { messageFrom } from "@/shared/lib/errors";
import { Button } from "@/shared/ui";
import { PortalCard, PortalFrame } from "../../_components/PortalFrame";

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
      subtitle="First consent happens when you submit onboarding. This page is for later re-consent when the agency updates its notice."
    >
      {consentQuery.isError ? (
        <p className="font-body text-sm text-cadence-red">{messageFrom(consentQuery.error)}</p>
      ) : consentVersion === 0 ? (
        <p className="font-body text-sm text-cadence-ink/70">
          Your agency hasn&apos;t set up a consent notice yet — there&apos;s nothing to agree to
          right now.
        </p>
      ) : (
        <PortalCard>
          <div className="whitespace-pre-wrap font-body text-sm text-cadence-ink">{consentText}</div>
          <p className="mt-3 font-fine text-[11px] text-cadence-ink/45">Version {consentVersion}</p>
          <Button onClick={handleAgree} disabled={submitting || captured} className="mt-4">
            {captured ? "Consent recorded" : submitting ? "Recording…" : "I agree"}
          </Button>
          {error ? <p className="mt-2 font-body text-sm text-cadence-red">{error}</p> : null}
        </PortalCard>
      )}
    </PortalFrame>
  );
}
