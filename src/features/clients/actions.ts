import { api } from "@/api/client";
import type {
  Client,
  ClientBilling,
  ClientBillingWrite,
  ClientContact,
  ClientContactWrite,
  ClientWrite,
} from "@/features/clients/types";

export function createClient(body: ClientWrite): Promise<Client> {
  return api.post<Client>("/api/v1/clients/", body);
}

export function updateClient(id: string, body: Partial<ClientWrite>): Promise<Client> {
  return api.patch<Client>(`/api/v1/clients/${id}/`, body);
}

/** DELETE here is the archive act (soft-delete: `deleted_at`, never a
 * status enum — ARCHITECTURE.md/AGENTS.md invariants), not a hard delete. */
export function archiveClient(id: string): Promise<void> {
  return api.delete<void>(`/api/v1/clients/${id}/`);
}

export function updateClientBilling(
  clientId: string,
  body: ClientBillingWrite,
): Promise<ClientBilling> {
  return api.put<ClientBilling>(`/api/v1/clients/${clientId}/billing/`, body);
}

export function createClientContact(
  clientId: string,
  body: ClientContactWrite,
): Promise<ClientContact> {
  return api.post<ClientContact>(`/api/v1/clients/${clientId}/contacts/`, body);
}

export function updateClientContact(
  clientId: string,
  contactId: string,
  body: Partial<ClientContactWrite>,
): Promise<ClientContact> {
  return api.patch<ClientContact>(`/api/v1/clients/${clientId}/contacts/${contactId}/`, body);
}

export function deleteClientContact(clientId: string, contactId: string): Promise<void> {
  return api.delete<void>(`/api/v1/clients/${clientId}/contacts/${contactId}/`);
}
