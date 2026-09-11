import { api, type Paginated } from "@/api/client";
import { resourceKeys } from "@/api/query-keys";
import type { ImportBatch, ImportDocument, ImportRow } from "@/features/candidate-imports/types";

export const importBatchKeys = resourceKeys("candidate-imports");

export function listBatches(page = 1): Promise<Paginated<ImportBatch>> {
  return api.get<Paginated<ImportBatch>>(`/api/v1/candidate-imports/?page=${page}`);
}

export function getBatch(id: string): Promise<ImportBatch> {
  return api.get<ImportBatch>(`/api/v1/candidate-imports/${id}/`);
}

export function listBatchRows(id: string, page = 1): Promise<Paginated<ImportRow>> {
  return api.get<Paginated<ImportRow>>(`/api/v1/candidate-imports/${id}/rows/?page=${page}`);
}

export function listBatchDocuments(id: string, page = 1): Promise<Paginated<ImportDocument>> {
  return api.get<Paginated<ImportDocument>>(`/api/v1/candidate-imports/${id}/documents/?page=${page}`);
}

export function uploadBatch(file: File): Promise<ImportBatch> {
  const formData = new FormData();
  formData.append("file", file);
  return api.post<ImportBatch>("/api/v1/candidate-imports/", formData);
}

export function commitBatch(id: string): Promise<ImportBatch> {
  return api.post<ImportBatch>(`/api/v1/candidate-imports/${id}/commit/`);
}
