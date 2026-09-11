"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notFound, useParams } from "next/navigation";
import { useState } from "react";
import { commitBatch, getBatch, importBatchKeys, listBatchDocuments, listBatchRows } from "@/features/candidate-imports/api";
import { isNotFound, messageFrom } from "@/shared/lib/errors";
import { CANDIDATE_IMPORT_BATCH_STATUS_LABELS, type CandidateImportBatchStatus } from "@/shared/lib/status-labels";
import { Badge, Button } from "@/shared/ui";

export default function CandidateImportBatchDetailPage() {
  const { id: batchId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [commitError, setCommitError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);

  const batchQuery = useQuery({
    queryKey: importBatchKeys.detail(batchId),
    queryFn: () => getBatch(batchId),
    retry: false,
  });
  const rowsQuery = useQuery({ queryKey: ["candidate-imports", batchId, "rows"], queryFn: () => listBatchRows(batchId) });
  const docsQuery = useQuery({ queryKey: ["candidate-imports", batchId, "documents"], queryFn: () => listBatchDocuments(batchId) });

  if (batchQuery.isError && isNotFound(batchQuery.error)) notFound();

  async function handleCommit() {
    setCommitting(true);
    setCommitError(null);
    try {
      await commitBatch(batchId);
      await queryClient.invalidateQueries({ queryKey: importBatchKeys.detail(batchId) });
    } catch (error) {
      setCommitError(messageFrom(error));
    } finally {
      setCommitting(false);
    }
  }

  if (batchQuery.isLoading) return <p className="font-body text-sm text-cadence-ink/60">Loading…</p>;
  if (batchQuery.isError) {
    return <p className="font-body text-sm text-cadence-red">{messageFrom(batchQuery.error)}</p>;
  }
  const batch = batchQuery.data;
  if (!batch) return null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-3xl text-cadence-ink">{batch.source_filename ?? "Import batch"}</h1>
          <Badge tone="info" className="mt-1">
            {CANDIDATE_IMPORT_BATCH_STATUS_LABELS[batch.status as CandidateImportBatchStatus]}
          </Badge>
        </div>
        {batch.status === "validated" ? (
          <Button onClick={handleCommit} disabled={committing}>
            {committing ? "Committing…" : "Commit"}
          </Button>
        ) : null}
      </div>
      {commitError ? <p className="font-body text-sm text-cadence-red">{commitError}</p> : null}
      {batch.error ? <p className="font-body text-sm text-cadence-red">{batch.error}</p> : null}

      <dl className="grid max-w-md grid-cols-2 gap-x-8 gap-y-3 font-body text-sm">
        <div>
          <dt className="text-cadence-ink/60">Rows</dt>
          <dd className="text-cadence-ink">
            {batch.valid_row_count ?? 0} valid / {batch.row_count ?? 0} total
          </dd>
        </div>
        <div>
          <dt className="text-cadence-ink/60">Documents</dt>
          <dd className="text-cadence-ink">
            {batch.matched_document_count ?? 0} matched / {batch.unmatched_document_count ?? 0} unmatched
          </dd>
        </div>
        <div>
          <dt className="text-cadence-ink/60">Committed</dt>
          <dd className="text-cadence-ink">
            {batch.committed_row_count ?? 0} rows, {batch.committed_document_count ?? 0} documents
          </dd>
        </div>
      </dl>

      <section className="flex flex-col gap-2">
        <h2 className="font-subheading text-xl text-cadence-ink">Rows</h2>
        {rowsQuery.data && rowsQuery.data.results.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {rowsQuery.data.results.map((row) => {
              // errors rides an untyped JSON field server-side (no items
              // schema in the contract) — only trust it at render time.
              const errors = Array.isArray(row.errors) ? (row.errors as unknown[]) : [];
              return (
                <li key={row.id} className="flex items-center justify-between px-4 py-3">
                  <p className="font-body text-sm text-cadence-ink">
                    Row {row.row_number}
                    {errors.length > 0 ? ` — ${errors.map(String).join(", ")}` : ""}
                  </p>
                  <Badge tone={row.match_status === "valid" ? "positive" : "negative"}>
                    {row.match_status}
                  </Badge>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="font-body text-sm text-cadence-ink/60">No rows.</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-subheading text-xl text-cadence-ink">Documents</h2>
        {docsQuery.data && docsQuery.data.results.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {docsQuery.data.results.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between px-4 py-3">
                <p className="font-body text-sm text-cadence-ink">{doc.original_filename}</p>
                <Badge tone={doc.match_status === "matched" ? "positive" : "warning"}>{doc.match_status}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-body text-sm text-cadence-ink/60">No documents.</p>
        )}
      </section>
    </div>
  );
}
