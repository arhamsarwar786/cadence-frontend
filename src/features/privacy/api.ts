import { api, type Paginated } from "@/api/client";
import { resourceKeys } from "@/api/query-keys";
import type { PrivacyRequest, PrivacyRequestAnswer, PrivacyRequestCreate } from "@/features/privacy/types";

export const privacyRequestKeys = resourceKeys("privacy-requests");

export function listPrivacyRequests(page = 1): Promise<Paginated<PrivacyRequest>> {
  return api.get<Paginated<PrivacyRequest>>(`/api/v1/privacy/requests/?page=${page}`);
}

export function getPrivacyRequest(id: string): Promise<PrivacyRequest> {
  return api.get<PrivacyRequest>(`/api/v1/privacy/requests/${id}/`);
}

export function createPrivacyRequest(body: PrivacyRequestCreate): Promise<PrivacyRequest> {
  return api.post<PrivacyRequest>("/api/v1/privacy/requests/", body);
}

export function answerPrivacyRequest(
  id: string,
  body: PrivacyRequestAnswer,
): Promise<PrivacyRequest> {
  return api.post<PrivacyRequest>(`/api/v1/privacy/requests/${id}/answer/`, body);
}
