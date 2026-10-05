"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { listSignatureRequests, revokeSignatureRequest, signatureRequestKeys } from "@/features/esign/api";
import { RequestSignatureDialog } from "@/features/esign/components/RequestSignatureDialog";
import { SignatureRequestDetailDialog } from "@/features/esign/components/SignatureRequestDetailDialog";
import type { SignatureRequest } from "@/features/esign/types";
import { useOrgTimeZone } from "@/auth/use-org-timezone";
import { PERM } from "@/permissions/keys";
import {
  Badge,
  Button,
  FilterChip,
  ListSkeleton,
  PageBody,
  PageFrame,
  PageHeader,
  Pagination,
  PermGate,
  QueryError,
  Table,
  useConfirm,
  useToast,
  type Column,
} from "@/shared/ui";
import { formatDate } from "@/shared/lib/datetime";
import { messageFrom } from "@/shared/lib/errors";
import {
  SIGNATURE_REQUEST_PURPOSE_LABELS,
  SIGNATURE_REQUEST_STATUS_LABELS,
  type SignatureRequestPurpose,
  type SignatureRequestStatus,
} from "@/shared/lib/status-labels";

const PAGE_SIZE = 50;
const STATUSES = Object.keys(SIGNATURE_REQUEST_STATUS_LABELS) as SignatureRequestStatus[];
const PURPOSES = Object.keys(SIGNATURE_REQUEST_PURPOSE_LABELS) as SignatureRequestPurpose[];

function asStatus(value: string | null): SignatureRequestStatus | undefined {
  return STATUSES.includes(value as SignatureRequestStatus) ? (value as SignatureRequestStatus) : undefined;
}

function asPurpose(value: string | null): SignatureRequestPurpose | undefined {
  return PURPOSES.includes(value as SignatureRequestPurpose) ? (value as SignatureRequestPurpose) : undefined;
}

export default function EsignPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const timeZone = useOrgTimeZone();
  const toast = useToast();
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const status = asStatus(searchParams.get("status"));
  const purpose = asPurpose(searchParams.get("purpose"));
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: signatureRequestKeys.list({ page, status, purpose }),
    queryFn: () => listSignatureRequests({ page, status, purpose }),
  });

  function setParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`/esign?${params.toString()}`);
  }

  async function handleRevoke(id: string) {
    const ok = await confirm({
      title: "Revoke this signature request?",
      body: "The worker will no longer be able to sign this request.",
      confirmLabel: "Revoke",
      danger: true,
    });
    if (!ok) return;
    setRevokeError(null);
    try {
      await revokeSignatureRequest(id);
      await queryClient.invalidateQueries({ queryKey: signatureRequestKeys.all });
      toast.success("Signature request revoked.");
    } catch (err) {
      setRevokeError(messageFrom(err));
    }
  }

  const date = (iso: string | null | undefined) => (iso && timeZone ? formatDate(iso, timeZone) : "—");

  const columns: Column<SignatureRequest>[] = [
    {
      header: "Document",
      cell: (r) =>
        r.label?.trim() ? (
          <span className="break-words">{r.label}</span>
        ) : (
          <span className="text-cadence-ink/45">—</span>
        ),
    },
    { header: "Purpose", cell: (r) => SIGNATURE_REQUEST_PURPOSE_LABELS[r.purpose as SignatureRequestPurpose] },
    {
      header: "Status",
      cell: (r) => (
        <Badge tone={r.status === "signed" ? "positive" : r.status === "declined" ? "negative" : "info"}>
          {SIGNATURE_REQUEST_STATUS_LABELS[(r.status ?? "pending") as SignatureRequestStatus]}
        </Badge>
      ),
    },
    { header: "Signer", cell: (r) => r.signer_email },
    { header: "Expires", cell: (r) => date(r.expires_at) },
    { header: "Signed", cell: (r) => date(r.signed_at) },
    {
      header: "",
      cell: (r) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => setDetailId(r.id)}>
            View
          </Button>
          {r.status === "pending" ? (
            <PermGate anyOf={PERM.ESIGN_REQUEST_SEND}>
              <Button size="sm" variant="danger" onClick={() => handleRevoke(r.id)}>
                Revoke
              </Button>
            </PermGate>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <PageFrame>
      <PageHeader
        title="E-sign"
        actions={
          <PermGate anyOf={PERM.ESIGN_REQUEST_SEND}>
            <Button onClick={() => setRequestOpen(true)}>Request signature</Button>
          </PermGate>
        }
      />

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2" aria-label="Filter by status">
          <FilterChip active={!status} onClick={() => setParams({ status: null, page: null })}>
            All statuses
          </FilterChip>
          {STATUSES.map((s) => (
            <FilterChip key={s} active={status === s} onClick={() => setParams({ status: s, page: null })}>
              {SIGNATURE_REQUEST_STATUS_LABELS[s]}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Filter by purpose">
          <FilterChip active={!purpose} onClick={() => setParams({ purpose: null, page: null })}>
            All purposes
          </FilterChip>
          {PURPOSES.map((p) => (
            <FilterChip key={p} active={purpose === p} onClick={() => setParams({ purpose: p, page: null })}>
              {SIGNATURE_REQUEST_PURPOSE_LABELS[p]}
            </FilterChip>
          ))}
        </div>
      </div>

      <PageBody>
        {revokeError ? (
          <p role="alert" className="font-body text-sm text-cadence-red">
            {revokeError}
          </p>
        ) : null}

        {query.isLoading ? (
          <ListSkeleton />
        ) : query.isError ? (
          <QueryError error={query.error} onRetry={() => query.refetch()} />
        ) : (
          <>
            <Table
              columns={columns}
              rows={query.data?.results ?? []}
              rowKey={(r) => r.id}
              emptyMessage="No signature requests."
            />
            {query.data ? (
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                count={query.data.count}
                onPageChange={(next) => setParams({ page: String(next) })}
              />
            ) : null}
          </>
        )}
      </PageBody>

      <RequestSignatureDialog open={requestOpen} onClose={() => setRequestOpen(false)} />
      <SignatureRequestDetailDialog
        requestId={detailId}
        timeZone={timeZone ?? null}
        onClose={() => setDetailId(null)}
        onRevoke={async (id) => {
          setDetailId(null);
          await handleRevoke(id);
        }}
      />
      {confirmDialog}
    </PageFrame>
  );
}
