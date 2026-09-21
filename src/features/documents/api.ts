import { api, type Paginated } from "@/api/client";
import { resourceKeys } from "@/api/query-keys";
import type { Document } from "@/features/documents/types";
import type { DocumentType } from "@/shared/lib/status-labels";

export const documentKeys = resourceKeys("documents");

export interface ListDocumentsParams {
  page?: number;
  pageSize?: number;
  type?: string;
}

export function listDocuments(params: ListDocumentsParams = {}): Promise<Paginated<Document>> {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("page_size", String(params.pageSize));
  if (params.type) search.set("type", params.type);
  const qs = search.toString();
  return api.get<Paginated<Document>>(`/api/v1/documents/${qs ? `?${qs}` : ""}`);
}

export function uploadDocument(file: File, type: DocumentType): Promise<Document> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);
  return api.post<Document>("/api/v1/documents/", formData);
}

export function deleteDocument(id: string): Promise<void> {
  return api.delete<void>(`/api/v1/documents/${id}/`);
}

/** Same-origin download door — cookies ride the browser request. */
export function documentDownloadUrl(id: string): string {
  return `/api/v1/documents/${id}/download/`;
}
