"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useOrgTimeZone } from "@/auth/use-org-timezone";
import { deleteDocument, documentKeys, listDocuments, uploadDocument } from "@/features/documents/api";
import { formatDate } from "@/shared/lib/datetime";
import { messageFrom } from "@/shared/lib/errors";
import { DOCUMENT_TYPE_LABELS, NON_GENERIC_DOCUMENT_TYPES, type DocumentType } from "@/shared/lib/status-labels";
import { PERM } from "@/permissions/keys";
import { Button, PageHeader, Pagination, PermGate, Select, Table, ListSkeleton, useConfirm, type Column } from "@/shared/ui";
import type { Document } from "@/features/documents/types";

const PAGE_SIZE = 50;
const GENERIC_TYPES = (Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).filter(
  (t) => !NON_GENERIC_DOCUMENT_TYPES.includes(t),
);

export default function DocumentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const timeZone = useOrgTimeZone();
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const queryClient = useQueryClient();
  const [docType, setDocType] = useState<DocumentType>("other");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const typeFilter = searchParams.get("type") ?? "";
  const query = useQuery({
    queryKey: documentKeys.list({ page, type: typeFilter || "generic-pool" }),
    queryFn: () =>
      listDocuments({
        page,
        pageSize: PAGE_SIZE,
        // Prefer API type filter when set; otherwise leave unfiltered and
        // still hide non-generic types only if the API cannot express "generic".
        type: typeFilter || undefined,
      }),
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
    const ok = await confirm({
      title: "Delete this document?",
      body: "The file is removed from the office store. This cannot be undone from this screen.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    await deleteDocument(id);
    await invalidate();
  }

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(nextPage));
    router.push(`/documents?${params.toString()}`);
  }

  function setType(next: string) {
    const params = new URLSearchParams(searchParams);
    if (next) params.set("type", next);
    else params.delete("type");
    params.set("page", "1");
    router.push(`/documents?${params.toString()}`);
  }

  // Always trust the API page. Use ?type= to narrow; do not filter after fetch.
  const rows = query.data?.results ?? [];


  const columns: Column<Document>[] = [
    { header: "File", cell: (d) => d.original_filename ?? "—" },
    { header: "Type", cell: (d) => DOCUMENT_TYPE_LABELS[d.type as DocumentType] ?? d.type },
    { header: "Uploaded", cell: (d) => (timeZone ? formatDate(d.created_at, timeZone) : "—") },
    {
      header: "",
      cell: (d) => (
        <div className="flex gap-2">
          <a
            href={`/api/v1/documents/${d.id}/download/`}
            target="_blank"
            rel="noreferrer"
            className="font-body text-sm text-cadence-yellow underline"
          >
            Download
          </a>
          <PermGate anyOf={PERM.DOCUMENTS_DELETE}>
            <Button size="sm" variant="ghost" onClick={() => handleDelete(d.id)}>
              Delete
            </Button>
          </PermGate>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Documents"
        actions={
        <PermGate anyOf={PERM.DOCUMENTS_UPLOAD}>
        <div className="flex items-center gap-2">
          <Select value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)} className="w-auto">
            {GENERIC_TYPES.map((t) => (
              <option key={t} value={t}>
                {DOCUMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-cadence-yellow px-3 py-1.5 font-body text-sm text-cadence-ink">
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
        </PermGate>
        }
      />
      {error ? <p className="font-body text-sm text-cadence-red">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <label className="font-body text-sm text-cadence-ink/60" htmlFor="doc-filter">
          Filter type
        </label>
        <Select
          id="doc-filter"
          value={typeFilter}
          onChange={(e) => setType(e.target.value)}
          className="w-auto"
        >
          <option value="">All types</option>
          {GENERIC_TYPES.map((t) => (
            <option key={t} value={t}>
              {DOCUMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </div>

      {query.isLoading ? (
        <ListSkeleton />
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
      {confirmDialog}
    </div>
  );
}
