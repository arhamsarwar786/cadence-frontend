import type { components } from "@openapi/schema";

export type PortalEmployee = components["schemas"]["PortalEmployee"] & {
  work_authorization_expiry?: string | null;
};
export type PortalMeWrite = components["schemas"]["PatchedPortalMeWrite"] & {
  work_authorization_expiry?: string | null;
};
export type PortalPersonal = components["schemas"]["PortalPersonal"];
export type PortalShift = components["schemas"]["PortalShift"];
export type PortalSignature = components["schemas"]["PortalSignature"];
export type PortalSignatureRequest = components["schemas"]["PortalSignatureRequest"];

// Sub-resources reuse the same shapes as the staff workers feature — the
// backend's portal doors accept/return the identical serializers.
export type {
  EmployeeAvailability as PortalAvailability,
  EmployeeAvailabilityWrite as PortalAvailabilityWrite,
  EmployeeCert as PortalCert,
  EmployeeCertWrite as PortalCertWrite,
  EmployeeDocument as PortalDocumentLink,
  EmployeeEducation as PortalEducation,
  EmployeeEducationWrite as PortalEducationWrite,
  EmployeeSkill as PortalSkill,
  EmployeeSkillWrite as PortalSkillWrite,
  EmployeeTimeOff as PortalTimeOff,
  EmployeeTimeOffWrite as PortalTimeOffWrite,
  EmploymentHistory as PortalEmploymentHistory,
  EmploymentHistoryWrite as PortalEmploymentHistoryWrite,
  Skill,
} from "@/features/workers/types";
