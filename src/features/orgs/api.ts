import { api } from "@/api/client";
import type { components } from "@openapi/schema";

type Document = components["schemas"]["Document"];
type OrgLogoResult = components["schemas"]["OrgLogoResult"];
type OrgConsentTextResult = components["schemas"]["OrgConsentTextResult"];
export type OrgSettings = components["schemas"]["OrgSettings"];
export type OrgSettingsPatch = components["schemas"]["PatchedOrgSettingsWrite"];

export const orgKeys = {
  settings: ["org", "settings"] as const,
};

export function getOrgSettings(): Promise<OrgSettings> {
  return api.get<OrgSettings>("/api/v1/org/");
}

/** Partial update — send only writable fields. Refused keys are a 400, not a silent no-op. */
export function updateOrgSettings(body: OrgSettingsPatch): Promise<OrgSettings> {
  return api.patch<OrgSettings>("/api/v1/org/", body);
}

export function uploadLogo(file: File): Promise<Document> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", "org_logo");
  return api.post<Document>("/api/v1/documents/", formData);
}

export function setOrgLogo(documentId: string | null): Promise<OrgLogoResult> {
  return api.put<OrgLogoResult>("/api/v1/org/logo/", { document_id: documentId });
}

export function setConsentText(text: string): Promise<OrgConsentTextResult> {
  return api.put<OrgConsentTextResult>("/api/v1/org/consent-text/", { text });
}
