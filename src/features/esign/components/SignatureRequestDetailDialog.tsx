"use client";

import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  getSignatureRequest,
  signatureRequestDocumentUrl,
  signatureRequestKeys,
} from "@/features/esign/api";
import { PERM } from "@/permissions/keys";
import { formatDateTime } from "@/shared/lib/datetime";
import {
  SIGNATURE_REQUEST_PURPOSE_LABELS,
  SIGNATURE_REQUEST_STATUS_LABELS,
  type SignatureRequestPurpose,
  type SignatureRequestStatus,
} from "@/shared/lib/status-labels";
import { Button, Dialog, PermGate, QueryError } from "@/shared/ui";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 py-1.5">
      <dt className="font-body text-xs uppercase tracking-wide opacity-60">{label}</dt>
      <dd className="break-words font-body text-sm">{children}</dd>
    </div>
  );
}

export function SignatureRequestDetailDialog({
  requestId,
  timeZone,
  onClose,
  onRevoke,
}: {
  requestId: string | null;
  timeZone: string | null;
  onClose: () => void;
  onRevoke: (id: string) => void;
}) {
  const query = useQuery({
    queryKey: signatureRequestKeys.detail(requestId ?? ""),
    queryFn: () => getSignatureRequest(requestId as string),
    enabled: Boolean(requestId),
  });
  const r = query.data;
  const when = (iso: string | null | undefined) => (iso && timeZone ? formatDateTime(iso, timeZone) : "—");

  return (
    <Dialog open={Boolean(requestId)} onClose={onClose} title="Signature request">
      {query.isLoading ? (
        <p className="font-body text-sm opacity-70">Loading…</p>
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => query.refetch()} />
      ) : r ? (
        <div className="flex flex-col gap-4">
          <dl className="divide-y divide-current/10">
            {r.label?.trim() ? <Row label="Document">{r.label}</Row> : null}
            <Row label="Purpose">{SIGNATURE_REQUEST_PURPOSE_LABELS[r.purpose as SignatureRequestPurpose]}</Row>
            <Row label="Status">{SIGNATURE_REQUEST_STATUS_LABELS[(r.status ?? "pending") as SignatureRequestStatus]}</Row>
            <Row label="Signer">{r.signer_email}</Row>
            <Row label="Sent">{when(r.created_at)}</Row>
            <Row label="Expires">{when(r.expires_at)}</Row>
            {r.status === "signed" ? (
              <>
                <Row label="Signed as">{r.signed_name || "—"}</Row>
                <Row label="Signed at">{when(r.signed_at)}</Row>
              </>
            ) : null}
            {r.status === "declined" ? <Row label="Decline reason">{r.decline_reason || "—"}</Row> : null}
          </dl>
          <div className="flex flex-wrap justify-end gap-2">
            {r.status === "pending" ? (
              <PermGate anyOf={PERM.ESIGN_REQUEST_SEND}>
                <Button variant="danger" onClick={() => onRevoke(r.id)}>
                  Revoke
                </Button>
              </PermGate>
            ) : null}
            <a href={signatureRequestDocumentUrl(r.id)} download>
              <Button variant="inverse">
                {r.status === "signed" ? "Download signed copy" : "Download document"}
              </Button>
            </a>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
