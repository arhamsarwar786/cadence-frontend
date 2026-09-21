import { api, type Paginated } from "@/api/client";
import { resourceKeys } from "@/api/query-keys";
import type { components } from "@openapi/schema";

export type DestructionSchedule = components["schemas"]["DestructionSchedule"];
export type DestructionDelay = components["schemas"]["DestructionDelay"];
export type DestructionHold = components["schemas"]["DestructionHold"];

export const disposalKeys = resourceKeys("privacy-disposal");

export interface ListDisposalParams {
  page?: number;
  pageSize?: number;
  held?: boolean | null;
}

export function listDisposalSchedules(
  params: ListDisposalParams = {},
): Promise<Paginated<DestructionSchedule>> {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("page_size", String(params.pageSize));
  if (params.held === true) search.set("held", "true");
  if (params.held === false) search.set("held", "false");
  const qs = search.toString();
  return api.get<Paginated<DestructionSchedule>>(
    `/api/v1/privacy/disposal/${qs ? `?${qs}` : ""}`,
  );
}

export function delayDisposal(pk: string, body: DestructionDelay): Promise<DestructionSchedule> {
  return api.post<DestructionSchedule>(`/api/v1/privacy/disposal/${pk}/delay/`, body);
}

export function holdDisposal(pk: string, body: DestructionHold): Promise<DestructionSchedule> {
  return api.post<DestructionSchedule>(`/api/v1/privacy/disposal/${pk}/hold/`, body);
}

export function releaseDisposal(pk: string): Promise<DestructionSchedule> {
  return api.post<DestructionSchedule>(`/api/v1/privacy/disposal/${pk}/release/`);
}

export function destroyDisposal(pk: string): Promise<DestructionSchedule> {
  return api.post<DestructionSchedule>(`/api/v1/privacy/disposal/${pk}/destroy/`);
}
