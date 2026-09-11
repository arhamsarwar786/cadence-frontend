import { api } from "@/api/client";
import type { components } from "@openapi/schema";

type Document = components["schemas"]["Document"];
type OrgLogoResult = components["schemas"]["OrgLogoResult"];
type OrgConsentTextResult = components["schemas"]["OrgConsentTextResult"];

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
