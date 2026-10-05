"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { declineRequest, saveSignature, signRequest } from "@/features/portal/actions";
import {
  getSignature,
  getSignatureRequestDocument,
  listSignatureRequests,
  signatureRequestDocumentUrl,
} from "@/features/portal/api";
import type { PortalSignatureRequest } from "@/features/portal/types";
import { isBadRequest, isNotFound, messageFrom } from "@/shared/lib/errors";
import {
  SIGNATURE_REQUEST_PURPOSE_LABELS,
  type SignatureRequestPurpose,
} from "@/shared/lib/status-labels";
import {
  Button,
  Dialog,
  Field,
  QueryError,
  SignaturePad,
  Textarea,
  useToast,
  type SignaturePadHandle,
} from "@/shared/ui";
import { PortalCard, PortalFrame } from "../../_components/PortalFrame";

const REQUESTS_KEY = ["portal", "signature-requests"] as const;
const SIGNATURE_KEY = ["portal", "signature"] as const;

const PURPOSE_TITLES: Record<SignatureRequestPurpose, string> = {
  onboarding: "Onboarding confirmation",
  payroll_release: "Payroll release",
  general: "Document from the office",
};

function purposeTitle(req: PortalSignatureRequest): string {
  const purpose = req.purpose as SignatureRequestPurpose;
  return PURPOSE_TITLES[purpose] ?? SIGNATURE_REQUEST_PURPOSE_LABELS[purpose] ?? "Signature request";
}

/** The document's own name when the office gave one (stored on the
 * request); older requests carry none, so the purpose stands in. */
function requestTitle(req: PortalSignatureRequest): string {
  return req.label?.trim() || purposeTitle(req);
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { dateStyle: "medium" });
}

export default function SignaturesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const requestsQuery = useQuery({ queryKey: REQUESTS_KEY, queryFn: listSignatureRequests });
  const signatureQuery = useQuery({ queryKey: SIGNATURE_KEY, queryFn: getSignature });
  const [reviewing, setReviewing] = useState<PortalSignatureRequest | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);

  const hasSignature = Boolean(signatureQuery.data);

  return (
    <PortalFrame
      title="Signatures"
      subtitle="Save your signature once, then review and sign — or decline — the agency’s forms. Signing confirms you reviewed the document."
    >
      <SavedSignatureCard
        hasSignature={hasSignature}
        loading={signatureQuery.isLoading}
        onSaved={() => queryClient.invalidateQueries({ queryKey: SIGNATURE_KEY })}
      />

      {receiptId ? (
        <PortalCard>
          <p className="font-body text-sm text-cadence-ink">
            Signed. Your stamped copy is ready.{" "}
            <a href={signatureRequestDocumentUrl(receiptId)} download className="underline">
              Download signed copy
            </a>
          </p>
        </PortalCard>
      ) : null}

      <PortalCard>
        <h2 className="font-subheading text-xl text-cadence-ink">To sign</h2>
        {requestsQuery.isLoading ? (
          <p className="mt-3 font-body text-sm text-cadence-ink/60">Loading…</p>
        ) : requestsQuery.isError ? (
          <QueryError className="mt-4" error={requestsQuery.error} onRetry={() => requestsQuery.refetch()} />
        ) : requestsQuery.data && requestsQuery.data.length > 0 ? (
          <ul className="mt-4 flex flex-col divide-y divide-border">
            {requestsQuery.data.map((req) => (
              <li key={req.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="break-words font-body text-sm font-medium text-cadence-ink">
                    {requestTitle(req)}
                  </p>
                  <p className="font-body text-xs text-cadence-ink/60">
                    {req.label?.trim() ? `${purposeTitle(req)} · ` : ""}
                    Sent {shortDate(req.generated_on)} · Sign by {shortDate(req.expires_at)}
                  </p>
                </div>
                <Button size="sm" onClick={() => setReviewing(req)}>
                  Review &amp; sign
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 font-body text-sm text-cadence-ink/60">Nothing to sign right now.</p>
        )}
      </PortalCard>

      <ReviewDialog
        request={reviewing}
        hasSignature={hasSignature}
        onClose={() => setReviewing(null)}
        onDone={async (outcome, id, message) => {
          setReviewing(null);
          // Drop the row now so a stale "Review & sign" can't be clicked while the list refetches.
          queryClient.setQueryData<PortalSignatureRequest[]>(REQUESTS_KEY, (rows) =>
            rows?.filter((r) => r.id !== id),
          );
          if (outcome === "signed") {
            setReceiptId(id);
            toast.success("Signed — thank you.");
          } else if (outcome === "declined") {
            toast.info("Request declined. The office has been told why.");
          } else if (message) {
            toast.error(message);
          }
          await queryClient.invalidateQueries({ queryKey: REQUESTS_KEY });
        }}
      />
    </PortalFrame>
  );
}

function SavedSignatureCard({
  hasSignature,
  loading,
  onSaved,
}: {
  hasSignature: boolean;
  loading: boolean;
  onSaved: () => Promise<unknown>;
}) {
  const padRef = useRef<SignaturePadHandle>(null);
  const [editing, setEditing] = useState(false);
  const [padEmpty, setPadEmpty] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showPad = editing || (!loading && !hasSignature);

  async function save(file: File) {
    setSaving(true);
    setError(null);
    try {
      await saveSignature(file);
      await onSaved();
      setEditing(false);
      padRef.current?.clear();
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveDrawn() {
    // Transparent background + dark ink: the PNG/RGBA shape the door wants.
    const blob = await padRef.current?.toBlob("image/png");
    if (!blob) return;
    await save(new File([blob], "signature.png", { type: "image/png" }));
  }

  return (
    <PortalCard>
      <h2 className="font-subheading text-xl text-cadence-ink">Your saved signature</h2>
      <p className="mt-1 font-body text-sm text-cadence-ink/60">
        {loading
          ? "Checking…"
          : hasSignature
            ? "On file — it is stamped onto each document you sign."
            : "Draw your signature below before you can sign."}
      </p>

      {showPad ? (
        <div className="mt-3 flex flex-col gap-3">
          <SignaturePad ref={padRef} label="Draw your signature" onChange={setPadEmpty} />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={padEmpty || saving} onClick={saveDrawn}>
              {saving ? "Saving…" : "Save signature"}
            </Button>
            <label className="inline-flex cursor-pointer items-center font-body text-sm text-cadence-ink underline">
              or upload a PNG
              <input
                type="file"
                accept="image/png"
                className="sr-only"
                disabled={saving}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void save(file);
                  e.target.value = "";
                }}
              />
            </label>
            {hasSignature ? (
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      ) : hasSignature ? (
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => setEditing(true)}>
          Replace signature
        </Button>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 font-body text-sm text-cadence-red">
          {error}
        </p>
      ) : null}
    </PortalCard>
  );
}

type Outcome = "signed" | "declined" | "stale";

function ReviewDialog({
  request,
  hasSignature,
  onClose,
  onDone,
}: {
  request: PortalSignatureRequest | null;
  hasSignature: boolean;
  onClose: () => void;
  onDone: (outcome: Outcome, id: string, message?: string) => void;
}) {
  const title = request ? requestTitle(request) : "Signature request";

  return (
    <Dialog open={Boolean(request)} onClose={onClose} title={title} wide>
      {request ? (
        // Keyed: a fresh body (no leftover reason / error) per request.
        <ReviewBody
          key={request.id}
          request={request}
          title={title}
          hasSignature={hasSignature}
          onDone={onDone}
        />
      ) : null}
    </Dialog>
  );
}

function ReviewBody({
  request,
  title,
  hasSignature,
  onDone,
}: {
  request: PortalSignatureRequest;
  title: string;
  hasSignature: boolean;
  onDone: (outcome: Outcome, id: string, message?: string) => void;
}) {
  const reasonId = useId();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const documentQuery = useQuery({
    queryKey: ["portal", "signature-request-document", request.id],
    queryFn: () => getSignatureRequestDocument(request.id),
    gcTime: 0,
    staleTime: Infinity,
    retry: false,
  });
  const blob = documentQuery.data;
  const pdfUrl = useMemo(
    () => (blob ? URL.createObjectURL(new Blob([blob], { type: "application/pdf" })) : null),
    [blob],
  );
  useEffect(
    () => () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    },
    [pdfUrl],
  );

  async function act(kind: "sign" | "decline") {
    setBusy(true);
    setError(null);
    try {
      if (kind === "sign") {
        await signRequest(request.id);
        onDone("signed", request.id);
      } else {
        await declineRequest(request.id, reason.trim());
        onDone("declined", request.id);
      }
    } catch (err) {
      // Already signed / declined / revoked, or expired while open: close,
      // say so, and refresh the list so the stale card goes away. A missing
      // saved signature stays open — the worker can fix that here.
      const message = messageFrom(err);
      if (isNotFound(err) || (isBadRequest(err) && !/save your signature/i.test(message))) {
        onDone("stale", request.id, message);
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="font-body text-sm opacity-80">
        {request.label?.trim() ? `${purposeTitle(request)} · ` : ""}Sign by{" "}
        {shortDate(request.expires_at)}.
      </p>

      {documentQuery.isError ? (
        <QueryError error={documentQuery.error} onRetry={() => documentQuery.refetch()} />
      ) : pdfUrl ? (
        <iframe title={title} src={pdfUrl} className="h-[min(60vh,36rem)] w-full rounded-xl bg-white" />
      ) : (
        <p className="font-body text-sm opacity-70">Loading document…</p>
      )}

      {declining ? (
        <Field label="Why are you declining?" htmlFor={reasonId} hint="The office sees this reason.">
          <Textarea id={reasonId} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      ) : null}

      {!hasSignature && !declining ? (
        <p className="font-body text-sm opacity-80">Save your signature on this page first, then come back to sign.</p>
      ) : null}

      {error ? (
        <p role="alert" className="font-body text-sm text-cadence-red">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        {declining ? (
          <>
            <Button variant="secondary" disabled={busy} onClick={() => setDeclining(false)}>
              Back
            </Button>
            <Button variant="danger" disabled={busy || !reason.trim()} onClick={() => act("decline")}>
              {busy ? "Declining…" : "Decline request"}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" disabled={busy} onClick={() => setDeclining(true)}>
              Decline
            </Button>
            <Button disabled={busy || !hasSignature || !pdfUrl} onClick={() => act("sign")}>
              {busy ? "Signing…" : "Sign"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
