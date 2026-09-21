import { api } from "@/api/client";
import type { ConsentRecord } from "@/features/workers/types";
import type {
  PortalAvailability,
  PortalAvailabilityWrite,
  PortalCert,
  PortalCertWrite,
  PortalDocumentLink,
  PortalEducation,
  PortalEducationWrite,
  PortalEmployee,
  PortalEmploymentHistory,
  PortalEmploymentHistoryWrite,
  PortalMeWrite,
  PortalSignature,
  PortalSignatureRequest,
  PortalSkill,
  PortalSkillWrite,
  PortalTimeOff,
  PortalTimeOffWrite,
} from "@/features/portal/types";

export function updateMe(body: PortalMeWrite): Promise<PortalEmployee> {
  return api.patch<PortalEmployee>("/api/v1/portal/me/", body);
}

/** Captures against the org's CURRENT consent text/version automatically
 * — refused until a root has set one (ARCHITECTURE.md, org consent
 * unset = consent_text="" / consent_version=0). No body: nothing to
 * choose, the org's live text is what's being agreed to. */
export function captureConsent(): Promise<ConsentRecord> {
  return api.post<ConsentRecord>("/api/v1/portal/me/consent/");
}

/** applicant -> onboarding (ARCHITECTURE.md §5): the worker's own
 * onboarding submission, once required fields are filled. */
export function submitOnboarding(consentAcknowledged: boolean): Promise<PortalEmployee> {
  return api.post<PortalEmployee>("/api/v1/portal/me/submit/", {
    consent_acknowledged: consentAcknowledged,
  });
}

export function acceptOffer(assignmentId: string): Promise<unknown> {
  return api.post(`/api/v1/portal/me/offers/${assignmentId}/accept/`);
}

/** Decline = DELETE the placement, never a third status
 * (ARCHITECTURE.md §5.1). */
export function declineOffer(assignmentId: string): Promise<unknown> {
  return api.post(`/api/v1/portal/me/offers/${assignmentId}/decline/`);
}

export function addCert(body: PortalCertWrite): Promise<PortalCert> {
  return api.post<PortalCert>("/api/v1/portal/me/certs/", body);
}

export function updateCert(certId: string, body: Partial<PortalCertWrite>): Promise<PortalCert> {
  return api.patch<PortalCert>(`/api/v1/portal/me/certs/${certId}/`, body);
}

export function deleteCert(certId: string): Promise<void> {
  return api.delete<void>(`/api/v1/portal/me/certs/${certId}/`);
}

export function addSkill(body: PortalSkillWrite): Promise<PortalSkill> {
  return api.post<PortalSkill>("/api/v1/portal/me/skills/", body);
}

export function updateSkill(skillId: string, body: Partial<PortalSkillWrite>): Promise<PortalSkill> {
  return api.patch<PortalSkill>(`/api/v1/portal/me/skills/${skillId}/`, body);
}

export function removeSkill(skillId: string): Promise<void> {
  return api.delete<void>(`/api/v1/portal/me/skills/${skillId}/`);
}

export function addAvailability(body: PortalAvailabilityWrite): Promise<PortalAvailability> {
  return api.post<PortalAvailability>("/api/v1/portal/me/availability/", body);
}

export function updateAvailability(
  rowId: string,
  body: Partial<PortalAvailabilityWrite>,
): Promise<PortalAvailability> {
  return api.patch<PortalAvailability>(`/api/v1/portal/me/availability/${rowId}/`, body);
}

export function deleteAvailability(rowId: string): Promise<void> {
  return api.delete<void>(`/api/v1/portal/me/availability/${rowId}/`);
}

export function addEducation(body: PortalEducationWrite): Promise<PortalEducation> {
  return api.post<PortalEducation>("/api/v1/portal/me/education/", body);
}

export function updateEducation(
  rowId: string,
  body: Partial<PortalEducationWrite>,
): Promise<PortalEducation> {
  return api.patch<PortalEducation>(`/api/v1/portal/me/education/${rowId}/`, body);
}

export function deleteEducation(rowId: string): Promise<void> {
  return api.delete<void>(`/api/v1/portal/me/education/${rowId}/`);
}

export function addEmploymentHistory(
  body: PortalEmploymentHistoryWrite,
): Promise<PortalEmploymentHistory> {
  return api.post<PortalEmploymentHistory>("/api/v1/portal/me/employment-history/", body);
}

export function deleteEmploymentHistory(rowId: string): Promise<void> {
  return api.delete<void>(`/api/v1/portal/me/employment-history/${rowId}/`);
}

export function addTimeOff(body: PortalTimeOffWrite): Promise<PortalTimeOff> {
  return api.post<PortalTimeOff>("/api/v1/portal/me/time-off/", body);
}

export function updateTimeOff(
  rowId: string,
  body: Partial<PortalTimeOffWrite>,
): Promise<PortalTimeOff> {
  return api.patch<PortalTimeOff>(`/api/v1/portal/me/time-off/${rowId}/`, body);
}

export function deleteTimeOff(rowId: string): Promise<void> {
  return api.delete<void>(`/api/v1/portal/me/time-off/${rowId}/`);
}

export function uploadDocument(file: File, type: string): Promise<PortalDocumentLink> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);
  return api.post<PortalDocumentLink>("/api/v1/portal/me/documents/", formData);
}

export function removeDocument(linkId: string): Promise<void> {
  return api.delete<void>(`/api/v1/portal/me/documents/${linkId}/`);
}

export function signRequest(requestId: string): Promise<PortalSignatureRequest> {
  return api.post<PortalSignatureRequest>(`/api/v1/portal/me/signature-requests/${requestId}/sign/`);
}

export function declineRequest(
  requestId: string,
  reason: string,
): Promise<PortalSignatureRequest> {
  return api.post<PortalSignatureRequest>(
    `/api/v1/portal/me/signature-requests/${requestId}/decline/`,
    { reason },
  );
}

/** Multipart: the one portal upload exception for the saved-signature
 * image itself (esign/views.py's PortalSignatureView). */
export function saveSignature(file: File): Promise<PortalSignature> {
  const formData = new FormData();
  formData.append("file", file);
  return api.put<PortalSignature>("/api/v1/portal/me/signature/", formData);
}
