"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { removeDocument, uploadDocument } from "@/features/portal/actions";
import { listDocuments } from "@/features/portal/api";
import { messageFrom } from "@/shared/lib/errors";
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "@/shared/lib/status-labels";
import { Button, Select, useConfirm } from "@/shared/ui";

const DEFAULT_UPLOADABLE: DocumentType[] = [
  "resume",
  "work_permit",
  "study_permit",
  "sin_document",
  "gov_id",
  "other",
];
const QUERY_KEY = ["portal", "documents"] as const;

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="inline h-3.5 w-3.5 shrink-0" aria-hidden fill="currentColor">
      <path d="M8 1a3 3 0 0 0-3 3v2H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1V4a3 3 0 0 0-3-3zm1 5V4a1 1 0 1 0-2 0v2h2z" />
    </svg>
  );
}

export function DocumentsPanel({
  allowedTypes = DEFAULT_UPLOADABLE,
}: {
  /** Restrict upload types (onboarding: résumé / permit only). */
  allowedTypes?: DocumentType[];
}) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: listDocuments });
  const [docType, setDocType] = useState<DocumentType>(allowedTypes[0] ?? "other");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      await uploadDocument(file, docType);
      await invalidate();
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(linkId: string) {
    const ok = await confirm({
      title: "Remove this document?",
      body: "The file will be removed from your profile.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    await removeDocument(linkId);
    await invalidate();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={docType}
          onChange={(e) => setDocType(e.target.value as DocumentType)}
          className="w-auto min-w-0 max-w-full"
        >
          {allowedTypes.map((t) => (
            <option key={t} value={t}>
              {DOCUMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 font-body text-sm text-cadence-ink hover:bg-surface-muted">
          {uploading ? "Uploading…" : "Upload"}
          <input
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {error ? <p className="font-body text-xs text-cadence-red">{error}</p> : null}
      {query.data && query.data.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
          {query.data.map((doc) => (
            <li key={doc.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-body text-sm font-medium text-cadence-ink">
                  {doc.is_verified ? <LockIcon /> : null}
                  <span className="truncate">{doc.original_filename}</span>
                </p>
                <p className="mt-0.5 font-body text-xs text-cadence-ink/60">
                  {DOCUMENT_TYPE_LABELS[doc.document_type as DocumentType] ?? doc.document_type}
                  {" · "}
                  {doc.is_verified ? "Verified" : "Unverified"}
                </p>
              </div>
              {doc.is_verified ? (
                <span className="shrink-0 font-body text-xs text-cadence-ink/55">Locked</span>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => handleRemove(doc.id)}>
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-sm text-cadence-ink/60">No documents on file.</p>
      )}
      <p className="font-fine text-[11px] text-cadence-ink/55">
        A verified document is locked once your office confirms it.
      </p>
      {confirmDialog}
    </div>
  );
}
