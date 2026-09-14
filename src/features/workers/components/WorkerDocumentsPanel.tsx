"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  attachWorkerDocument,
  removeWorkerDocument,
  uploadDocument,
  verifyWorkerDocument,
} from "@/features/workers/actions";
import { listWorkerDocuments } from "@/features/workers/api";
import { messageFrom } from "@/shared/lib/errors";
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "@/shared/lib/status-labels";
import { Button, Select, useConfirm } from "@/shared/ui";

const UPLOADABLE_TYPES: DocumentType[] = ["resume", "cert", "work_permit", "study_permit", "other"];

export function WorkerDocumentsPanel({ workerId }: { workerId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["workers", workerId, "documents"] as const;
  const query = useQuery({ queryKey, queryFn: () => listWorkerDocuments(workerId) });
  const [docType, setDocType] = useState<DocumentType>("other");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey });
  }

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const doc = await uploadDocument(file, docType);
      await attachWorkerDocument(workerId, { document_id: doc.id });
      await invalidate();
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleVerify(linkId: string) {
    await verifyWorkerDocument(workerId, linkId);
    await invalidate();
  }

  async function handleRemove(linkId: string) {
    const ok = await confirm({
      title: "Remove this document?",
      body: "The file will be detached from this worker.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    await removeWorkerDocument(workerId, linkId);
    await invalidate();
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-subheading text-xl text-cadence-ink">Documents</h2>
        <div className="flex items-center gap-2">
          <Select
            value={docType}
            onChange={(e) => setDocType(e.target.value as DocumentType)}
            className="w-auto"
          >
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
      </div>

      {error ? <p className="font-body text-xs text-cadence-red">{error}</p> : null}

      {query.isLoading ? (
        <p className="font-body text-sm text-cadence-ink/60">Loading…</p>
      ) : query.data && query.data.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {query.data.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-body text-sm font-medium text-cadence-ink">
                  {doc.original_filename}
                  {doc.is_verified ? (
                    <span className="ml-2 text-xs text-emerald-700">Verified</span>
                  ) : null}
                </p>
                <p className="font-body text-xs text-cadence-ink/60">
                  {DOCUMENT_TYPE_LABELS[doc.document_type as DocumentType] ?? doc.document_type}
                </p>
              </div>
              <div className="flex gap-2">
                {!doc.is_verified ? (
                  <Button size="sm" variant="secondary" onClick={() => handleVerify(doc.id)}>
                    Verify
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => handleRemove(doc.id)}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-sm text-cadence-ink/60">No documents on file.</p>
      )}
      {confirmDialog}
    </section>
  );
}
