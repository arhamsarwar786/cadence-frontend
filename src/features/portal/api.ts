import { api, ApiError } from "@/api/client";
import type { Payslip, PayslipDetail } from "@/features/money/types";
import type {
  PortalAvailability,
  PortalCert,
  PortalDocumentLink,
  PortalEducation,
  PortalEmployee,
  PortalEmploymentHistory,
  PortalPersonal,
  PortalShift,
  PortalSignature,
  PortalSignatureRequest,
  PortalSkill,
  PortalTimeOff,
  Skill,
} from "@/features/portal/types";

export function getMe(): Promise<PortalEmployee> {
  return api.get<PortalEmployee>("/api/v1/portal/me/");
}

export function getPersonal(): Promise<PortalPersonal> {
  return api.get<PortalPersonal>("/api/v1/portal/me/personal/");
}

export function listShifts(): Promise<PortalShift[]> {
  return api.get<PortalShift[]>("/api/v1/portal/me/shifts/");
}

export function listCerts(): Promise<PortalCert[]> {
  return api.get<PortalCert[]>("/api/v1/portal/me/certs/");
}

export function listSkillCatalog(): Promise<Skill[]> {
  return api.get<Skill[]>("/api/v1/portal/me/skill-catalog/");
}

export function listSkills(): Promise<PortalSkill[]> {
  return api.get<PortalSkill[]>("/api/v1/portal/me/skills/");
}

export function listAvailability(): Promise<PortalAvailability[]> {
  return api.get<PortalAvailability[]>("/api/v1/portal/me/availability/");
}

export function listEducation(): Promise<PortalEducation[]> {
  return api.get<PortalEducation[]>("/api/v1/portal/me/education/");
}

export function listEmploymentHistory(): Promise<PortalEmploymentHistory[]> {
  return api.get<PortalEmploymentHistory[]>("/api/v1/portal/me/employment-history/");
}

export function listTimeOff(): Promise<PortalTimeOff[]> {
  return api.get<PortalTimeOff[]>("/api/v1/portal/me/time-off/");
}

export function listDocuments(): Promise<PortalDocumentLink[]> {
  return api.get<PortalDocumentLink[]>("/api/v1/portal/me/documents/");
}

export function listPayslips(): Promise<Payslip[]> {
  return api.get<Payslip[]>("/api/v1/portal/me/payslips/");
}

export function getPayslip(id: string): Promise<PayslipDetail> {
  return api.get<PayslipDetail>(`/api/v1/portal/me/payslips/${id}/`);
}

export function listSignatureRequests(): Promise<PortalSignatureRequest[]> {
  return api.get<PortalSignatureRequest[]>("/api/v1/portal/me/signature-requests/");
}

export function getSignature(): Promise<PortalSignature | null> {
  return api.get<PortalSignature>("/api/v1/portal/me/signature/").catch((err: unknown) => {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  });
}
