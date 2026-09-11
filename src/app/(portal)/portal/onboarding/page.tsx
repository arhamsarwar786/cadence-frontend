"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { captureConsent, submitOnboarding, updateMe } from "@/features/portal/actions";
import { getMe } from "@/features/portal/api";
import { DocumentsPanel } from "@/features/portal/components/DocumentsPanel";
import { messageFrom } from "@/shared/lib/errors";
import { Button, Select } from "@/shared/ui";

const ME_KEY = ["portal", "me"] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const meQuery = useQuery({ queryKey: ME_KEY, queryFn: getMe });
  const [consented, setConsented] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [workAuth, setWorkAuth] = useState("");

  async function handleConsent() {
    setConsentError(null);
    try {
      await captureConsent();
      setConsented(true);
    } catch (error) {
      setConsentError(messageFrom(error));
    }
  }

  async function handleWorkAuthChange(value: string) {
    setWorkAuth(value);
    if (value === "citizen_pr" || value === "permit") {
      await updateMe({ work_authorization: value });
      await queryClient.invalidateQueries({ queryKey: ME_KEY });
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitOnboarding();
      await queryClient.invalidateQueries({ queryKey: ME_KEY });
      router.push("/portal");
    } catch (error) {
      setSubmitError(messageFrom(error));
    } finally {
      setSubmitting(false);
    }
  }

  const me = meQuery.data;
  if (me && me.lifecycle_status !== "applicant") {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl text-cadence-ink">Onboarding</h1>
        <p className="font-body text-sm text-cadence-ink/70">
          Your onboarding has already been submitted.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-3xl text-cadence-ink">Onboarding</h1>
        <p className="mt-1 font-body text-sm text-cadence-ink/70">
          Complete these steps, then submit for review: consent, work authorization, and your
          documents (résumé, SIN document, two photo IDs, and a permit if it applies).
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-subheading text-xl text-cadence-ink">1. Consent</h2>
        <Button size="sm" onClick={handleConsent} disabled={consented} className="self-start">
          {consented ? "Consent recorded" : "I agree to the collection and use of my information"}
        </Button>
        {consentError ? <p className="font-body text-xs text-cadence-red">{consentError}</p> : null}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-subheading text-xl text-cadence-ink">2. Work authorization</h2>
        <Select
          value={workAuth || me?.work_authorization || ""}
          onChange={(e) => handleWorkAuthChange(e.target.value)}
          className="max-w-xs"
        >
          <option value="">Select…</option>
          <option value="citizen_pr">Canadian citizen or permanent resident</option>
          <option value="permit">Work or study permit</option>
        </Select>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-subheading text-xl text-cadence-ink">3. Documents</h2>
        <DocumentsPanel />
      </section>

      <section className="flex flex-col gap-2">
        {submitError ? <p className="font-body text-sm text-cadence-red">{submitError}</p> : null}
        <Button onClick={handleSubmit} disabled={submitting} className="self-start">
          {submitting ? "Submitting…" : "Submit for review"}
        </Button>
      </section>
    </div>
  );
}
