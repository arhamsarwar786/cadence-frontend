import { api, type Paginated } from "@/api/client";
import { resourceKeys } from "@/api/query-keys";
import type { Client, ClientBilling, ClientContact } from "@/features/clients/types";

export const clientKeys = resourceKeys("clients");

export interface ListClientsParams {
  page?: number;
  pageSize?: number;
}

export function listClients(params: ListClientsParams = {}): Promise<Paginated<Client>> {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("page_size", String(params.pageSize));
  const qs = search.toString();
  return api.get<Paginated<Client>>(`/api/v1/clients/${qs ? `?${qs}` : ""}`);
}

export function getClient(id: string): Promise<Client> {
  return api.get<Client>(`/api/v1/clients/${id}/`);
}

export function getClientBilling(clientId: string): Promise<ClientBilling> {
  return api.get<ClientBilling>(`/api/v1/clients/${clientId}/billing/`);
}

export function listClientContacts(clientId: string): Promise<ClientContact[]> {
  return api.get<ClientContact[]>(`/api/v1/clients/${clientId}/contacts/`);
}
