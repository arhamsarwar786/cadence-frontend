"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { captureConsent, saveSignature, submitOnboarding, updateMe } from "@/features/portal/actions";
import { getConsentText, getMe, listDocuments, portalConsentKey } from "@/features/portal/api";
import { CertsPanel } from "@/features/portal/components/CertsPanel";
import { DocumentsPanel } from "@/features/portal/components/DocumentsPanel";
import { AVAILABILITY_ACTIVE_ONLY_MESSAGE } from "@/features/workers/lifecycle";
import type { ConsentRecord } from "@/features/workers/types";
import { messageFrom } from "@/shared/lib/errors";
import { Button, Select, SignaturePad, type SignaturePadHandle } from "@/shared/ui";
import { PortalCard, PortalFrame } from "../../_components/PortalFrame";

const ME_KEY = ["portal", "me"] as const;
const DOCS_KEY = ["portal", "documents"] as const;

const STEPS = [
  "Welcome",
  "Work authorization",
  "Documents",
  "Certifications",
  "Availability",
  "Agreement",
  "Submit",
] as const;

const STEP_ALIASES: Record<string, number> = {
  welcome: 0,
  "work-auth": 1,
  work_auth: 1,
  docs: 2,
  documents: 2,
  certs: 3,
  certifications: 3,
  availability: 4,
  consent: 5,
  agreement: 5,
  submit: 6,
};

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const meQuery = useQuery({ queryKey: ME_KEY, queryFn: getMe });
  const docsQuery = useQuery({ queryKey: DOCS_KEY, queryFn: listDocuments });
  const consentTextQuery = useQuery({ queryKey: ["portal", "consent-text"], queryFn: getConsentText });
  const cachedConsent = queryClient.getQueryData<ConsentRecord>(portalConsentKey);

  const initialStep = STEP_ALIASES[searchParams.get("step") ?? ""] ?? 0;
  const [step, setStep] = useState(initialStep);
  const [acknowledged, setAcknowledged] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [workAuth, setWorkAuth] = useState("");
  const [permitExpiry, setPermitExpiry] = useState("");
  const [done, setDone] = useState(false);
  const signatureRef = useRef<SignaturePadHandle>(null);

  const me = meQuery.data;
  const docs = docsQuery.data ?? [];
  const consentVersion = consentTextQuery.data?.consent_version ?? 0;
  const serverConsent = me?.consent ?? cachedConsent ?? null;
  const consentCaptured =
    Boolean(serverConsent) &&
    (consentVersion === 0 || serverConsent?.version === consentVersion);

  useEffect(() => {
    if (serverConsent) {
      queryClient.setQueryData(portalConsentKey, serverConsent);
      setAcknowledged(true);
    }
  }, [serverConsent, queryClient]);

  useEffect(() => {
    const alias = searchParams.get("step");
    if (alias && alias in STEP_ALIASES) setStep(STEP_ALIASES[alias]);
  }, [searchParams]);

  const resume = docs.some((d) => d.document_type === "resume");
  const sin = docs.some((d) => d.document_type === "sin_document");
  const govIds = docs.filter((d) => d.document_type === "gov_id").length;
  const authorization = workAuth || me?.work_authorization || "";
  const permitNeeded = authorization === "permit";
  const permitDoc = docs.some(
    (d) => d.document_type === "work_permit" || d.document_type === "study_permit",
  );

  const checks = useMemo(
    () => [
      {
        ok: consentCaptured || acknowledged,
        label: consentCaptured
          ? `Consent on file (v${serverConsent?.version ?? consentVersion})`
          : "Consent acknowledged",
      },
      {
        ok: authorization === "citizen_pr" || authorization === "permit",
        label: "Work authorization",
      },
      {
        ok:
          !permitNeeded ||
          (permitDoc && Boolean(permitExpiry || me?.work_authorization_expiry)),
        label: "Permit + expiry (if on a permit)",
      },
      { ok: resume, label: "Résumé" },
      {
        ok: sin,
        label: "SIN document (office may collect if you cannot upload)",
      },
      {
        ok: govIds >= 2,
        label: `Two photo IDs (${govIds}/2 — office may collect)`,
      },
    ],
    [
      consentCaptured,
      acknowledged,
      serverConsent?.version,
      consentVersion,
      authorization,
      permitNeeded,
      permitDoc,
      permitExpiry,
      me?.work_authorization_expiry,
      resume,
      sin,
      govIds,
    ],
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

  async function persistConsent() {
    if (consentCaptured) return true;
    if (!acknowledged) return false;
    if (consentVersion === 0) return acknowledged;
    setConsentSaving(true);
    setConsentError(null);
    try {
      const record = await captureConsent();
      queryClient.setQueryData(portalConsentKey, record);
      await queryClient.invalidateQueries({ queryKey: ME_KEY });
      return true;
    } catch (error) {
      setConsentError(messageFrom(error));
      return false;
    } finally {
      setConsentSaving(false);
    }
  }

  async function handleConsentContinue() {
    setConsentError(null);
    if (signatureRef.current && !signatureRef.current.isEmpty()) {
      try {
        const blob = await signatureRef.current.toBlob();
        if (blob) {
          const file = new File([blob], "signature.png", { type: "image/png" });
          await saveSignature(file);
        }
      } catch (error) {
        setConsentError(messageFrom(error));
        return;
      }
    }
    const ok = await persistConsent();
    if (ok) setStep(6);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const consentOk = consentCaptured || (await persistConsent());
      await submitOnboarding(Boolean(consentOk || acknowledged));
      await queryClient.invalidateQueries({ queryKey: ME_KEY });
      setDone(true);
    } catch (error) {
      setSubmitError(messageFrom(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (me && me.lifecycle_status !== "applicant" && !done) {
    return (
      <PortalFrame
        title="Onboarding"
        subtitle="Your onboarding has already been submitted. The office reviews it before you become bookable."
      />
    );
  }

  if (done) {
    return (
      <PortalFrame title="You're all set" subtitle="The office will review what you submitted.">
        <PortalCard>
          <p className="font-body text-sm text-cadence-ink/70">
            A copy of your submission is with your agency. You can go to your jobs and offers from
            home.
          </p>
          <Button className="mt-4" onClick={() => router.push("/portal")}>
            Go to My Jobs
          </Button>
        </PortalCard>
      </PortalFrame>
    );
  }

  return (
    <PortalFrame
      title="Onboarding"
      subtitle={`Step ${step + 1} of ${STEPS.length} — ${STEPS[step]}`}
    >
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-cadence-ink/10">
        <div
          className="h-full rounded-full bg-cadence-yellow transition-all"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      {step === 0 ? (
        <PortalCard className="overflow-hidden">
          <h2 className="font-heading text-2xl text-cadence-ink">Let&apos;s get you set up</h2>
          <p className="mt-2 text-sm text-cadence-ink/60">Takes about 5 minutes.</p>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-cadence-ink/70">
            <li>Work authorization</li>
            <li>Résumé and permit uploads</li>
            <li>Certifications &amp; licenses</li>
            <li>Availability</li>
            <li>Agreement &amp; consent</li>
          </ul>
          <p className="mt-4 rounded-xl bg-cadence-yellow/30 px-3 py-2 text-xs text-cadence-ink/70">
            SIN, date of birth, banking, photo ID on the encrypted path, and self-serve account
            creation need new portal doors — your office may still collect those after review.
          </p>
          <Button className="mt-6" onClick={() => setStep(1)}>
            Get started
          </Button>
        </PortalCard>
      ) : null}

      {step === 1 ? (
        <PortalCard>
          <h2 className="font-subheading text-xl text-cadence-ink">Work authorization</h2>
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
                className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-cadence-ink"
                value={permitExpiry || me?.work_authorization_expiry || ""}
                onChange={(e) => handlePermitExpiry(e.target.value)}
              />
            </label>
          ) : null}
          <StepNav onBack={() => setStep(0)} onNext={() => setStep(2)} />
        </PortalCard>
      ) : null}

      {step === 2 ? (
        <PortalCard>
          <h2 className="font-subheading text-xl text-cadence-ink">Upload your documents</h2>
          <p className="mt-1 mb-4 font-body text-sm text-cadence-ink/60">
            Upload your résumé
            {permitNeeded ? " and work/study permit" : ""}. SIN and government photo IDs may be
            collected by your office until those portal doors exist.
          </p>
          <DocumentsPanel allowedTypes={["resume", "work_permit", "study_permit"]} />
          <StepNav onBack={() => setStep(1)} onNext={() => setStep(3)} />
        </PortalCard>
      ) : null}

      {step === 3 ? (
        <PortalCard>
          <h2 className="font-subheading text-xl text-cadence-ink">Certifications &amp; licenses</h2>
          <p className="mt-1 mb-4 text-sm text-cadence-ink/60">Optional now — add what you have.</p>
          <CertsPanel />
          <StepNav onBack={() => setStep(2)} onNext={() => setStep(4)} />
        </PortalCard>
      ) : null}

      {step === 4 ? (
        <PortalCard>
          <h2 className="font-subheading text-xl text-cadence-ink">Availability</h2>
          <p className="mt-1 mb-4 text-sm text-cadence-ink/60">{AVAILABILITY_ACTIVE_ONLY_MESSAGE}</p>
          <p className="font-body text-sm text-cadence-ink/70">
            After the office activates you, set weekly windows under{" "}
            <strong>Profile → Availability</strong> in the dock.
          </p>
          <StepNav onBack={() => setStep(3)} onNext={() => setStep(5)} />
        </PortalCard>
      ) : null}

      {step === 5 ? (
        <PortalCard>
          <h2 className="font-subheading text-xl text-cadence-ink">Agreement &amp; consent</h2>
          {consentCaptured ? (
            <p className="mt-3 rounded-xl bg-cadence-lime/25 px-3 py-2 font-body text-sm text-cadence-ink">
              Consent already on file
              {serverConsent?.version != null ? ` (version ${serverConsent.version})` : ""}.
            </p>
          ) : null}
          {consentTextQuery.data?.consent_version ? (
            <>
              <div className="scroll-area-y mt-3 max-h-[min(12rem,35dvh)] whitespace-pre-wrap rounded-2xl bg-surface-muted p-4 font-body text-sm text-cadence-ink">
                {consentTextQuery.data.consent_text}
              </div>
              <p className="mt-2 font-fine text-[11px] text-cadence-ink/60">
                Version {consentTextQuery.data.consent_version}
              </p>
              {!consentCaptured ? (
                <label className="mt-4 flex items-start gap-2 font-body text-sm text-cadence-ink">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                  />
                  I consent to this collection and use of my information, and I agree to the terms
                  above.
                </label>
              ) : null}
              <div className="mt-4">
                <p className="mb-2 font-fine text-[10px] uppercase tracking-wide text-cadence-ink/60">
                  Signature
                </p>
                <SignaturePad ref={signatureRef} label="Tap to sign" />
                <button
                  type="button"
                  className="mt-2 font-body text-xs text-cadence-ink/55 underline"
                  onClick={() => signatureRef.current?.clear()}
                >
                  Clear signature
                </button>
              </div>
            </>
          ) : (
            <p className="mt-2 font-body text-sm text-cadence-ink/60">
              {consentTextQuery.isError
                ? messageFrom(consentTextQuery.error)
                : "Your agency has not published a consent notice yet."}
            </p>
          )}
          {consentError ? (
            <p className="mt-2 font-body text-sm text-cadence-red">{consentError}</p>
          ) : null}
          <StepNav
            onBack={() => setStep(4)}
            onNext={() => void handleConsentContinue()}
            nextDisabled={
              (!consentCaptured && !acknowledged) ||
              consentSaving ||
              (consentVersion > 0 && !consentCaptured && !acknowledged)
            }
            nextLabel={consentSaving ? "Saving…" : "Continue"}
          />
        </PortalCard>
      ) : null}

      {step === 6 ? (
        <PortalCard>
          <h2 className="font-subheading text-xl text-cadence-ink">Ready to submit</h2>
          <ul className="mt-3 flex flex-col gap-1.5 font-body text-sm">
            {checks.map((item) => (
              <li key={item.label} className={item.ok ? "text-cadence-ink" : "text-cadence-ink/60"}>
                {item.ok ? "●" : "○"} {item.label}
              </li>
            ))}
          </ul>
          <p className="mt-3 font-fine text-[11px] text-cadence-ink/55">
            The server still requires résumé, SIN, two photo IDs, and a permit when applicable —
            items your office may complete if you cannot upload them here.
          </p>
          {submitError ? <p className="mt-3 font-body text-sm text-cadence-red">{submitError}</p> : null}
          <div className="mt-6 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setStep(5)}>
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                submitting ||
                !(consentCaptured || acknowledged) ||
                !(authorization === "citizen_pr" || authorization === "permit") ||
                !resume ||
                (permitNeeded &&
                  !(permitDoc && Boolean(permitExpiry || me?.work_authorization_expiry)))
              }
            >
              {submitting ? "Submitting…" : "Agree & submit"}
            </Button>
          </div>
        </PortalCard>
      ) : null}
    </PortalFrame>
  );
}

function StepNav({
  onBack,
  onNext,
  nextDisabled,
  nextLabel = "Continue",
}: {
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      <Button type="button" variant="secondary" onClick={onBack}>
        Back
      </Button>
      <Button type="button" onClick={onNext} disabled={nextDisabled}>
        {nextLabel}
      </Button>
    </div>
  );
}
