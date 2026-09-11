"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { deleteDocument, documentKeys, listDocuments, uploadDocument } from "@/features/documents/api";
import { messageFrom } from "@/shared/lib/errors";
import { DOCUMENT_TYPE_LABELS, NON_GENERIC_DOCUMENT_TYPES, type DocumentType } from "@/shared/lib/status-labels";
import { Button, Pagination, Select, Table, type Column } from "@/shared/ui";
import type { Document } from "@/features/documents/types";

const PAGE_SIZE = 50;
const GENERIC_TYPES = (Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).filter(
  (t) => !NON_GENERIC_DOCUMENT_TYPES.includes(t),
);

export default function DocumentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const queryClient = useQueryClient();
  const [docType, setDocType] = useState<DocumentType>("other");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: documentKeys.list({ page }),
    queryFn: () => listDocuments({ page, pageSize: PAGE_SIZE }),
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: documentKeys.all });
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

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this document?")) return;
    await deleteDocument(id);
    await invalidate();
  }

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(nextPage));
    router.push(`/documents?${params.toString()}`);
  }

  // Generic documents UI never lists invoice/payslip/signed_form/esign_form
  // rows — those ride the money/esign screens (ARCHITECTURE.md §5.1).
  const rows = (query.data?.results ?? []).filter(
    (d) => !NON_GENERIC_DOCUMENT_TYPES.includes(d.type as DocumentType),
  );

  const columns: Column<Document>[] = [
    { header: "File", cell: (d) => d.original_filename ?? "—" },
    { header: "Type", cell: (d) => DOCUMENT_TYPE_LABELS[d.type as DocumentType] ?? d.type },
    { header: "Uploaded", cell: (d) => new Date(d.created_at).toLocaleDateString() },
    {
      header: "",
      cell: (d) => (
        <div className="flex gap-2">
          <a
            href={`/api/v1/documents/${d.id}/download/`}
            target="_blank"
            rel="noreferrer"
            className="font-body text-sm text-cadence-red underline"
          >
            Download
          </a>
          <Button size="sm" variant="ghost" onClick={() => handleDelete(d.id)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl text-cadence-ink">Documents</h1>
        <div className="flex items-center gap-2">
          <Select value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)} className="w-auto">
            {GENERIC_TYPES.map((t) => (
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
      {error ? <p className="font-body text-sm text-cadence-red">{error}</p> : null}

      {query.isLoading ? (
        <p className="font-body text-sm text-cadence-ink/60">Loading…</p>
      ) : query.isError ? (
        <p className="font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>
      ) : (
        <>
          <Table columns={columns} rows={rows} rowKey={(d) => d.id} emptyMessage="No documents yet." />
          {query.data ? (
            <Pagination page={page} pageSize={PAGE_SIZE} count={query.data.count} onPageChange={goToPage} />
          ) : null}
        </>
      )}
    </div>
  );
}
