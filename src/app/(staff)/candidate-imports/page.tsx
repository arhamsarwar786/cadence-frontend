"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/auth/session-context";
import {
  buildSampleImportPackage,
  describeMigrationPublicKeyError,
  downloadBlob,
  fetchMigrationPublicKey,
} from "@/features/candidate-imports/build-package";
import { importBatchKeys, listBatches, uploadBatch } from "@/features/candidate-imports/api";
import type { ImportBatch } from "@/features/candidate-imports/types";
import { useOrgTimeZone } from "@/auth/use-org-timezone";
import { formatDate } from "@/shared/lib/datetime";
import { messageFrom } from "@/shared/lib/errors";
import {
  CANDIDATE_IMPORT_BATCH_STATUS_LABELS,
  type CandidateImportBatchStatus,
} from "@/shared/lib/status-labels";
import { PERM } from "@/permissions/keys";
import {
  Badge,
  Button,
  ListSkeleton,
  Pagination,
  PermGate,
  Table,
  type Column,
  PageFrame,
  PageBody,
} from "@/shared/ui";

const migrationPublicKeyQueryKey = ["candidate-imports", "public-key"] as const;

const PAGE_SIZE = 50;
const TONE: Record<CandidateImportBatchStatus, "neutral" | "info" | "positive" | "negative" | "warning"> = {
  uploaded: "neutral",
  validating: "info",
  validated: "info",
  failed: "negative",
  committing: "info",
  committed: "positive",
  committed_with_errors: "warning",
};

export default function CandidateImportsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSession();
  const orgId = session.session?.user.org_id;
  const searchParams = useSearchParams();
  const timeZone = useOrgTimeZone();
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const [uploading, setUploading] = useState(false);
  const [buildingSample, setBuildingSample] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publicKeyQuery = useQuery({
    queryKey: migrationPublicKeyQueryKey,
    queryFn: async () => {
      const der = await fetchMigrationPublicKey();
      return der.byteLength;
    },
    retry: false,
    staleTime: 5 * 60_000,
  });

  const query = useQuery({
    queryKey: importBatchKeys.list({ page }),
    queryFn: () => listBatches(page),
  });

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(nextPage));
    router.push(`/candidate-imports?${params.toString()}`);
  }

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const batch = await uploadBatch(file);
      await queryClient.invalidateQueries({ queryKey: importBatchKeys.all });
      router.push(`/candidate-imports/${batch.id}`);
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setUploading(false);
    }
  }

  const columns: Column<ImportBatch>[] = [
    { header: "File", cell: (b) => b.source_filename ?? "—" },
    {
      header: "Status",
      cell: (b) => (
        <Badge tone={TONE[b.status as CandidateImportBatchStatus]}>
          {CANDIDATE_IMPORT_BATCH_STATUS_LABELS[b.status as CandidateImportBatchStatus]}
        </Badge>
      ),
    },
    { header: "Rows", cell: (b) => `${b.valid_row_count ?? 0} / ${b.row_count ?? 0} valid` },
    { header: "Uploaded", cell: (b) => (timeZone ? formatDate(b.created_at, timeZone) : "—") },
  ];

  return (
    <PageFrame>
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl text-cadence-ink">Candidate imports</h1>
        <PermGate anyOf={PERM.CANDIDATE_IMPORTS_CREATE}>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={buildingSample || !orgId || publicKeyQuery.isError}
              onClick={async () => {
                if (!orgId) return;
                setBuildingSample(true);
                setError(null);
                try {
                  const blob = await buildSampleImportPackage(orgId);
                  downloadBlob(blob, "sample-candidates.migpkg");
                } catch (err) {
                  setError(messageFrom(err));
                } finally {
                  setBuildingSample(false);
                }
              }}
            >
              {buildingSample ? "Creating…" : "Create sample package"}
            </Button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-cadence-yellow px-4 py-2 font-body text-sm text-cadence-ink hover:bg-cadence-yellow/90">
              {uploading ? "Uploading…" : "Upload package"}
              <input
                type="file"
                className="hidden"
                accept=".migpkg,.pkg,application/octet-stream"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </PermGate>
      </div>
      <p className="font-body text-xs text-cadence-ink/60">
        Packages must be encrypted for your organization before upload. Use{" "}
        <strong className="font-medium">Create sample package</strong> to download a valid test file for this
        server, then upload it here.
      </p>
      {publicKeyQuery.isError ? (
        <p className="font-body text-sm text-cadence-red">
          {describeMigrationPublicKeyError(publicKeyQuery.error)} Sample packages cannot be created until{" "}
          <code className="text-xs">/api/v1/candidate-imports/public-key/</code> returns HTTP 200.
        </p>
      ) : null}
      {error ? <p className="font-body text-sm text-cadence-red">{error}</p> : null}

      <PageBody>


        {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError ? (
        <p className="font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>
      ) : (
        <>
          <Table
            columns={columns}
            rows={query.data?.results ?? []}
            rowKey={(b) => b.id}
            onRowClick={(b) => router.push(`/candidate-imports/${b.id}`)}
            emptyMessage="No import batches yet."
          />
          {query.data ? (
            <Pagination page={page} pageSize={PAGE_SIZE} count={query.data.count} onPageChange={goToPage} />
          ) : null}
        </>
      )}
    </PageBody>
    </PageFrame>
  );
}
