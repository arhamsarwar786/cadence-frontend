"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { submitOnboarding, updateMe } from "@/features/portal/actions";
import { getConsentText, getMe, listDocuments } from "@/features/portal/api";
import { DocumentsPanel } from "@/features/portal/components/DocumentsPanel";
import { messageFrom } from "@/shared/lib/errors";
import { Button, Select } from "@/shared/ui";
import { PortalCard, PortalFrame } from "../../_components/PortalFrame";

const ME_KEY = ["portal", "me"] as const;
const DOCS_KEY = ["portal", "documents"] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const meQuery = useQuery({ queryKey: ME_KEY, queryFn: getMe });
  const docsQuery = useQuery({ queryKey: DOCS_KEY, queryFn: listDocuments });
  const consentQuery = useQuery({ queryKey: ["portal", "consent-text"], queryFn: getConsentText });
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [workAuth, setWorkAuth] = useState("");
  const [permitExpiry, setPermitExpiry] = useState("");

  const me = meQuery.data;
  const docs = docsQuery.data ?? [];
  const resume = docs.some((d) => d.document_type === "resume");
  const sin = docs.some((d) => d.document_type === "sin_document");
  const govIds = docs.filter((d) => d.document_type === "gov_id").length;
  const authorization = workAuth || me?.work_authorization || "";
  const permitNeeded = authorization === "permit";
  const permitDoc = docs.some(
    (d) => d.document_type === "work_permit" || d.document_type === "study_permit",
  );

  async function handleWorkAuthChange(value: string) {
    setWorkAuth(value);
    if (value === "citizen_pr" || value === "permit") {
      await updateMe({
        work_authorization: value,
        work_authorization_expiry: value === "citizen_pr" ? null : undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ME_KEY });
    }
  }

  async function handlePermitExpiry(value: string) {
    setPermitExpiry(value);
    if (value) {
      await updateMe({ work_authorization_expiry: value });
      await queryClient.invalidateQueries({ queryKey: ME_KEY });
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitOnboarding(acknowledged);
      await queryClient.invalidateQueries({ queryKey: ME_KEY });
      router.push("/portal");
    } catch (error) {
      setSubmitError(messageFrom(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (me && me.lifecycle_status !== "applicant") {
    return (
      <PortalFrame
        title="Onboarding"
        subtitle="Your onboarding has already been submitted. The office reviews it before you become bookable."
      />
    );
  }

  const checks = [
    { ok: acknowledged, label: "Consent acknowledged" },
    { ok: authorization === "citizen_pr" || authorization === "permit", label: "Work authorization" },
    { ok: !permitNeeded || (permitDoc && Boolean(permitExpiry || me?.work_authorization_expiry)), label: "Permit + expiry (if on a permit)" },
    { ok: resume, label: "Résumé" },
    { ok: sin, label: "SIN document" },
    { ok: govIds >= 2, label: `Two photo IDs (${govIds}/2)` },
  ];

  return (
    <PortalFrame
      title="Onboarding"
      subtitle="Submitting is the consent act. Tick that you agree to the notice below, complete work authorization, upload the required files, then send it to the office."
    >
      <PortalCard>
        <h2 className="font-subheading text-sm uppercase tracking-[0.14em] text-cadence-ink/50">
          Checklist
        </h2>
        <ul className="mt-3 flex flex-col gap-1.5 font-body text-sm">
          {checks.map((item) => (
            <li key={item.label} className={item.ok ? "text-cadence-ink" : "text-cadence-ink/45"}>
              {item.ok ? "●" : "○"} {item.label}
            </li>
          ))}
        </ul>
      </PortalCard>

      <PortalCard>
        <h2 className="font-subheading text-xl text-cadence-ink">1. Consent</h2>
        {consentQuery.data?.consent_version ? (
          <>
            <div className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-2xl bg-surface-muted p-4 font-body text-sm text-cadence-ink">
              {consentQuery.data.consent_text}
            </div>
            <p className="mt-2 font-fine text-[11px] text-cadence-ink/45">
              Version {consentQuery.data.consent_version}
            </p>
            <label className="mt-4 flex items-start gap-2 font-body text-sm text-cadence-ink">
              <input
                type="checkbox"
                className="mt-1"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
              />
              I have read this notice and acknowledge it as part of submitting onboarding.
            </label>
          </>
        ) : (
          <p className="mt-2 font-body text-sm text-cadence-ink/60">
            {consentQuery.isError
              ? messageFrom(consentQuery.error)
              : "Your agency has not published a consent notice yet. Ask the office before submitting."}
          </p>
        )}
      </PortalCard>

      <PortalCard>
        <h2 className="font-subheading text-xl text-cadence-ink">2. Work authorization</h2>
        <Select
          value={authorization}
          onChange={(e) => handleWorkAuthChange(e.target.value)}
          className="mt-3 max-w-xs"
        >
          <option value="">Select…</option>
          <option value="citizen_pr">Canadian citizen or permanent resident</option>
          <option value="permit">Work or study permit</option>
        </Select>
        {permitNeeded ? (
          <label className="mt-3 block max-w-xs font-body text-sm text-cadence-ink">
            Permit expiry
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2"
              value={permitExpiry || me?.work_authorization_expiry || ""}
              onChange={(e) => handlePermitExpiry(e.target.value)}
            />
          </label>
        ) : null}
      </PortalCard>

      <PortalCard>
        <h2 className="font-subheading text-xl text-cadence-ink">3. Documents</h2>
        <p className="mt-1 mb-4 font-body text-sm text-cadence-ink/60">
          Required: résumé, SIN document, two government photo IDs. Add a work or study permit if
          you selected permit above.
        </p>
        <DocumentsPanel />
      </PortalCard>

      <div className="flex flex-col gap-2">
        {submitError ? <p className="font-body text-sm text-cadence-red">{submitError}</p> : null}
        <Button onClick={handleSubmit} disabled={submitting} className="self-start">
          {submitting ? "Submitting…" : "Submit for review"}
        </Button>
      </div>
    </PortalFrame>
  );
}
