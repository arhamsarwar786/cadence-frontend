"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { removeDocument, uploadDocument } from "@/features/portal/actions";
import { listDocuments } from "@/features/portal/api";
import { messageFrom } from "@/shared/lib/errors";
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "@/shared/lib/status-labels";
import { Button, Select, useConfirm } from "@/shared/ui";

const UPLOADABLE_TYPES: DocumentType[] = [
  "resume",
  "work_permit",
  "study_permit",
  "sin_document",
  "gov_id",
  "other",
];
const QUERY_KEY = ["portal", "documents"] as const;

export function DocumentsPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: listDocuments });
  const [docType, setDocType] = useState<DocumentType>("other");
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
      <div className="flex items-center gap-2">
        <Select value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)} className="w-auto">
          {UPLOADABLE_TYPES.map((t) => (
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
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {query.data.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-body text-sm font-medium text-cadence-ink">
                  {doc.original_filename}
                  {doc.is_verified ? <span className="ml-2 text-xs text-emerald-700">Verified</span> : null}
                </p>
                <p className="font-body text-xs text-cadence-ink/60">
                  {DOCUMENT_TYPE_LABELS[doc.document_type as DocumentType] ?? doc.document_type}
                </p>
              </div>
              {doc.is_verified ? (
                <span className="font-body text-xs text-cadence-ink/60">Office verified</span>
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
      {confirmDialog}
    </div>
  );
}
