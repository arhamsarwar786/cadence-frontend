"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { declineRequest, saveSignature, signRequest } from "@/features/portal/actions";
import { getSignature, listSignatureRequests } from "@/features/portal/api";
import { messageFrom } from "@/shared/lib/errors";
import {
  SIGNATURE_REQUEST_PURPOSE_LABELS,
  SIGNATURE_REQUEST_STATUS_LABELS,
  type SignatureRequestPurpose,
  type SignatureRequestStatus,
} from "@/shared/lib/status-labels";
import { Badge, Button } from "@/shared/ui";
import { PortalCard, PortalFrame } from "../../_components/PortalFrame";

const REQUESTS_KEY = ["portal", "signature-requests"] as const;
const SIGNATURE_KEY = ["portal", "signature"] as const;

export default function SignaturesPage() {
  const queryClient = useQueryClient();
  const requestsQuery = useQuery({ queryKey: REQUESTS_KEY, queryFn: listSignatureRequests });
  const signatureQuery = useQuery({ queryKey: SIGNATURE_KEY, queryFn: getSignature });
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  function invalidateRequests() {
    return queryClient.invalidateQueries({ queryKey: REQUESTS_KEY });
  }

  async function handleUploadSignature(file: File) {
    setUploading(true);
    setError(null);
    try {
      await saveSignature(file);
      await queryClient.invalidateQueries({ queryKey: SIGNATURE_KEY });
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleSign(id: string) {
    setPending(id);
    setError(null);
    try {
      await signRequest(id);
      await invalidateRequests();
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setPending(null);
    }
  }

  async function handleDecline(id: string) {
    const reason = window.prompt("Why are you declining this request?");
    if (!reason?.trim()) return;
    setPending(id);
    setError(null);
    try {
      await declineRequest(id, reason.trim());
      await invalidateRequests();
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setPending(null);
    }
  }

  return (
    <PortalFrame
      title="Signatures"
      subtitle="Save a PNG of your signature, then sign or decline the agency’s forms. Signing is not approval of pay — it confirms you reviewed the document."
    >
      <PortalCard>
        <h2 className="font-subheading text-xl text-cadence-ink">Your saved signature</h2>
        <p className="mt-1 font-body text-sm text-cadence-ink/60">
          {signatureQuery.data
            ? "On file — used when you sign a request."
            : "Upload a PNG with visible ink before you can sign."}
        </p>
        <label className="mt-3 inline-flex w-fit cursor-pointer items-center gap-2 rounded-full bg-cadence-yellow px-4 py-2 font-body text-sm text-cadence-ink">
          {uploading ? "Uploading…" : signatureQuery.data ? "Replace signature" : "Upload signature"}
          <input
            type="file"
            accept="image/png,image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUploadSignature(file);
              e.target.value = "";
            }}
          />
        </label>
      </PortalCard>

      {error ? <p className="font-body text-sm text-cadence-red">{error}</p> : null}

      <PortalCard>
        <h2 className="font-subheading text-xl text-cadence-ink">Requests</h2>
        {requestsQuery.data && requestsQuery.data.length > 0 ? (
          <ul className="mt-4 flex flex-col divide-y divide-border">
            {requestsQuery.data.map((req) => (
              <li key={req.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-body text-sm font-medium text-cadence-ink">
                    {SIGNATURE_REQUEST_PURPOSE_LABELS[req.purpose as SignatureRequestPurpose]}
                  </p>
                  <p className="font-body text-xs text-cadence-ink/60">Expires {req.expires_at}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={req.status === "signed" ? "positive" : "info"}>
                    {SIGNATURE_REQUEST_STATUS_LABELS[req.status as SignatureRequestStatus]}
                  </Badge>
                  <a
                    href={`/api/v1/portal/me/signature-requests/${req.id}/document/`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-body text-sm underline"
                  >
                    PDF
                  </a>
                  {req.status === "pending" ? (
                    <>
                      <Button size="sm" disabled={pending === req.id} onClick={() => handleSign(req.id)}>
                        Sign
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={pending === req.id}
                        onClick={() => handleDecline(req.id)}
                      >
                        Decline
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 font-body text-sm text-cadence-ink/60">No signature requests.</p>
        )}
      </PortalCard>
    </PortalFrame>
  );
}
