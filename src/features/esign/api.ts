import { api, type Paginated } from "@/api/client";
import { resourceKeys } from "@/api/query-keys";
import type { SignatureRequest } from "@/features/esign/types";

export const signatureRequestKeys = resourceKeys("esign-requests");

export function listSignatureRequests(page = 1): Promise<Paginated<SignatureRequest>> {
  return api.get<Paginated<SignatureRequest>>(`/api/v1/esign/requests/?page=${page}`);
}

export function revokeSignatureRequest(id: string): Promise<SignatureRequest> {
  return api.post<SignatureRequest>(`/api/v1/esign/requests/${id}/revoke/`);
}
