import { api, type Paginated } from "@/api/client";
import { resourceKeys } from "@/api/query-keys";
import type { SignatureRequest } from "@/features/esign/types";
import type { SignatureRequestPurpose, SignatureRequestStatus } from "@/shared/lib/status-labels";

export const signatureRequestKeys = resourceKeys("esign-requests");

export interface ListSignatureRequestsParams {
  page?: number;
  status?: SignatureRequestStatus;
  purpose?: SignatureRequestPurpose;
}

export function listSignatureRequests(
  params: ListSignatureRequestsParams = {},
): Promise<Paginated<SignatureRequest>> {
  const search = new URLSearchParams();
  search.set("page", String(params.page ?? 1));
  if (params.status) search.set("status", params.status);
  if (params.purpose) search.set("purpose", params.purpose);
  return api.get<Paginated<SignatureRequest>>(`/api/v1/esign/requests/?${search.toString()}`);
}

export function getSignatureRequest(id: string): Promise<SignatureRequest> {
  return api.get<SignatureRequest>(`/api/v1/esign/requests/${id}/`);
}

/** Pending: the source upload/render. Signed: the stamped output (a fresh
 * PDF — source pages + an appended signature page). Served as an
 * attachment, so a plain same-origin link downloads it. */
export function signatureRequestDocumentUrl(id: string): string {
  return `/api/v1/esign/requests/${id}/document/`;
}

export function revokeSignatureRequest(id: string): Promise<SignatureRequest> {
  return api.post<SignatureRequest>(`/api/v1/esign/requests/${id}/revoke/`);
}

export interface CreateSignatureRequestInput {
  file: File;
  employeeIds: string[];
  label?: string;
}

/** The manual assign door (esign/views.py SignatureRequestListView.post).
 * One worker rides `employee_id` and answers one object; several ride
 * repeated `employee_ids` and answer an array in submitted order,
 * all-or-nothing. Never both fields — the door refuses that. Normalized
 * to an array here so callers handle one shape. */
export async function createSignatureRequests({
  file,
  employeeIds,
  label,
}: CreateSignatureRequestInput): Promise<SignatureRequest[]> {
  const formData = new FormData();
  formData.append("file", file);
  if (employeeIds.length === 1) {
    formData.append("employee_id", employeeIds[0]);
  } else {
    for (const id of employeeIds) formData.append("employee_ids", id);
  }
  const trimmed = label?.trim();
  if (trimmed) formData.append("label", trimmed);
  const created = await api.post<SignatureRequest | SignatureRequest[]>(
    "/api/v1/esign/requests/",
    formData,
  );
  return Array.isArray(created) ? created : [created];
}
