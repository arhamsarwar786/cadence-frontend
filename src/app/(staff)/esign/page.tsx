"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { listSignatureRequests, revokeSignatureRequest, signatureRequestKeys } from "@/features/esign/api";
import type { SignatureRequest } from "@/features/esign/types";
import { useOrgTimeZone } from "@/auth/use-org-timezone";
import { PERM } from "@/permissions/keys";
import { Badge, Button, ListSkeleton, Pagination, PermGate, Table, useConfirm, type Column } from "@/shared/ui";
import { formatDate } from "@/shared/lib/datetime";
import { messageFrom } from "@/shared/lib/errors";
import {
  SIGNATURE_REQUEST_PURPOSE_LABELS,
  SIGNATURE_REQUEST_STATUS_LABELS,
  type SignatureRequestPurpose,
  type SignatureRequestStatus,
} from "@/shared/lib/status-labels";

const PAGE_SIZE = 50;

export default function EsignPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const timeZone = useOrgTimeZone();
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const { confirm, dialog: confirmDialog } = useConfirm();

  const query = useQuery({
    queryKey: signatureRequestKeys.list({ page }),
    queryFn: () => listSignatureRequests(page),
  });

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(nextPage));
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
    await revokeSignatureRequest(id);
    await queryClient.invalidateQueries({ queryKey: signatureRequestKeys.all });
  }

  const columns: Column<SignatureRequest>[] = [
    { header: "Purpose", cell: (r) => SIGNATURE_REQUEST_PURPOSE_LABELS[r.purpose as SignatureRequestPurpose] },
    {
      header: "Status",
      cell: (r) => (
        <Badge tone={r.status === "signed" ? "positive" : r.status === "declined" ? "negative" : "info"}>
          {SIGNATURE_REQUEST_STATUS_LABELS[r.status as SignatureRequestStatus]}
        </Badge>
      ),
    },
    { header: "Expires", cell: (r) => (timeZone ? formatDate(r.expires_at, timeZone) : "—") },
    {
      header: "",
      cell: (r) =>
        r.status === "pending" ? (
          <PermGate anyOf={PERM.ESIGN_REQUEST_SEND}>
            <Button size="sm" variant="danger" onClick={() => handleRevoke(r.id)}>
              Revoke
            </Button>
          </PermGate>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-3xl text-cadence-ink">E-sign</h1>
      {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError ? (
        <p className="font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>
      ) : (
        <>
          <Table columns={columns} rows={query.data?.results ?? []} rowKey={(r) => r.id} emptyMessage="No signature requests." />
          {query.data ? (
            <Pagination page={page} pageSize={PAGE_SIZE} count={query.data.count} onPageChange={goToPage} />
          ) : null}
        </>
      )}
      {confirmDialog}
    </div>
  );
}
