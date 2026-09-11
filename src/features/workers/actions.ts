import { api } from "@/api/client";
import type {
  BackgroundCheckWrite,
  Document,
  Employee,
  EmployeeAvailability,
  EmployeeAvailabilityWrite,
  EmployeeCert,
  EmployeeCertWrite,
  EmployeeDocument,
  EmployeeDocumentAttach,
  EmployeeEducation,
  EmployeeEducationWrite,
  EmployeeSkill,
  EmployeeSkillWrite,
  EmployeeTimeOff,
  EmployeeTimeOffWrite,
  EmployeeWrite,
  EmploymentHistory,
  EmploymentHistoryWrite,
  IncidentLog,
  IncidentVoid,
  PersonalWrite,
  Skill,
  SkillWrite,
  WorkerIncident,
} from "@/features/workers/types";

export function createWorker(body: EmployeeWrite): Promise<Employee> {
  return api.post<Employee>("/api/v1/workers/", body);
}

export function updateWorker(id: string, body: Partial<EmployeeWrite>): Promise<Employee> {
  return api.patch<Employee>(`/api/v1/workers/${id}/`, body);
}

// --- Lifecycle acts — never a status PATCH (ARCHITECTURE.md §5.2) --------

export function submitWorker(id: string): Promise<Employee> {
  return api.post<Employee>(`/api/v1/workers/${id}/submit/`);
}

export function approveWorker(id: string): Promise<Employee> {
  return api.post<Employee>(`/api/v1/workers/${id}/approve/`);
}

export function deactivateWorker(id: string): Promise<Employee> {
  return api.post<Employee>(`/api/v1/workers/${id}/deactivate/`);
}

export function rehireWorker(id: string): Promise<Employee> {
  return api.post<Employee>(`/api/v1/workers/${id}/rehire/`);
}

// --- PII ------------------------------------------------------------------

export function setPersonal(workerId: string, body: PersonalWrite): Promise<Employee> {
  return api.put<Employee>(`/api/v1/workers/${workerId}/personal/`, body);
}

export function attachGovIdDocument(
  workerId: string,
  documentId: string,
): Promise<EmployeeDocument> {
  return api.put<EmployeeDocument>(`/api/v1/workers/${workerId}/personal/gov-id/`, {
    document_id: documentId,
  });
}

export function setBackgroundCheck(
  workerId: string,
  body: BackgroundCheckWrite,
): Promise<Employee> {
  return api.put<Employee>(`/api/v1/workers/${workerId}/background-check/`, body);
}

// --- Certs ------------------------------------------------------------

export function createWorkerCert(
  workerId: string,
  body: EmployeeCertWrite,
): Promise<EmployeeCert> {
  return api.post<EmployeeCert>(`/api/v1/workers/${workerId}/certs/`, body);
}

export function updateWorkerCert(
  workerId: string,
  certId: string,
  body: Partial<EmployeeCertWrite>,
): Promise<EmployeeCert> {
  return api.patch<EmployeeCert>(`/api/v1/workers/${workerId}/certs/${certId}/`, body);
}

export function deleteWorkerCert(workerId: string, certId: string): Promise<void> {
  return api.delete<void>(`/api/v1/workers/${workerId}/certs/${certId}/`);
}

export function verifyWorkerCert(workerId: string, certId: string): Promise<EmployeeCert> {
  return api.post<EmployeeCert>(`/api/v1/workers/${workerId}/certs/${certId}/verify/`);
}

// --- Skills -----------------------------------------------------------

export function createSkillCatalogEntry(body: SkillWrite): Promise<Skill> {
  return api.post<Skill>("/api/v1/workers/skills/", body);
}

export function addWorkerSkill(
  workerId: string,
  body: EmployeeSkillWrite,
): Promise<EmployeeSkill> {
  return api.post<EmployeeSkill>(`/api/v1/workers/${workerId}/skills/`, body);
}

export function updateWorkerSkill(
  workerId: string,
  skillId: string,
  body: Partial<EmployeeSkillWrite>,
): Promise<EmployeeSkill> {
  return api.patch<EmployeeSkill>(`/api/v1/workers/${workerId}/skills/${skillId}/`, body);
}

export function removeWorkerSkill(workerId: string, skillId: string): Promise<void> {
  return api.delete<void>(`/api/v1/workers/${workerId}/skills/${skillId}/`);
}

// --- Availability -------------------------------------------------------

export function addAvailability(
  workerId: string,
  body: EmployeeAvailabilityWrite,
): Promise<EmployeeAvailability> {
  return api.post<EmployeeAvailability>(`/api/v1/workers/${workerId}/availability/`, body);
}

export function updateAvailability(
  workerId: string,
  rowId: string,
  body: Partial<EmployeeAvailabilityWrite>,
): Promise<EmployeeAvailability> {
  return api.patch<EmployeeAvailability>(
    `/api/v1/workers/${workerId}/availability/${rowId}/`,
    body,
  );
}

export function deleteAvailability(workerId: string, rowId: string): Promise<void> {
  return api.delete<void>(`/api/v1/workers/${workerId}/availability/${rowId}/`);
}

// --- Education ------------------------------------------------------------

export function addEducation(
  workerId: string,
  body: EmployeeEducationWrite,
): Promise<EmployeeEducation> {
  return api.post<EmployeeEducation>(`/api/v1/workers/${workerId}/education/`, body);
}

export function updateEducation(
  workerId: string,
  rowId: string,
  body: Partial<EmployeeEducationWrite>,
): Promise<EmployeeEducation> {
  return api.patch<EmployeeEducation>(`/api/v1/workers/${workerId}/education/${rowId}/`, body);
}

export function deleteEducation(workerId: string, rowId: string): Promise<void> {
  return api.delete<void>(`/api/v1/workers/${workerId}/education/${rowId}/`);
}

// --- Employment history --------------------------------------------------

export function addEmploymentHistory(
  workerId: string,
  body: EmploymentHistoryWrite,
): Promise<EmploymentHistory> {
  return api.post<EmploymentHistory>(`/api/v1/workers/${workerId}/employment-history/`, body);
}

export function updateEmploymentHistory(
  workerId: string,
  rowId: string,
  body: Partial<EmploymentHistoryWrite>,
): Promise<EmploymentHistory> {
  return api.patch<EmploymentHistory>(
    `/api/v1/workers/${workerId}/employment-history/${rowId}/`,
    body,
  );
}

export function deleteEmploymentHistory(workerId: string, rowId: string): Promise<void> {
  return api.delete<void>(`/api/v1/workers/${workerId}/employment-history/${rowId}/`);
}

// --- Time off ------------------------------------------------------------

export function addTimeOff(
  workerId: string,
  body: EmployeeTimeOffWrite,
): Promise<EmployeeTimeOff> {
  return api.post<EmployeeTimeOff>(`/api/v1/workers/${workerId}/time-off/`, body);
}

export function updateTimeOff(
  workerId: string,
  rowId: string,
  body: Partial<EmployeeTimeOffWrite>,
): Promise<EmployeeTimeOff> {
  return api.patch<EmployeeTimeOff>(`/api/v1/workers/${workerId}/time-off/${rowId}/`, body);
}

export function deleteTimeOff(workerId: string, rowId: string): Promise<void> {
  return api.delete<void>(`/api/v1/workers/${workerId}/time-off/${rowId}/`);
}

// --- Incidents (voided, never deleted — ARCHITECTURE.md §5.1) -----------

export function logIncident(workerId: string, body: IncidentLog): Promise<WorkerIncident> {
  return api.post<WorkerIncident>(`/api/v1/workers/${workerId}/incidents/`, body);
}

export function voidIncident(
  workerId: string,
  incidentId: string,
  body: IncidentVoid,
): Promise<WorkerIncident> {
  return api.post<WorkerIncident>(
    `/api/v1/workers/${workerId}/incidents/${incidentId}/void/`,
    body,
  );
}

// --- Documents -------------------------------------------------------

export function uploadDocument(file: File, type: string): Promise<Document> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);
  return api.post<Document>("/api/v1/documents/", formData);
}

export function attachWorkerDocument(
  workerId: string,
  body: EmployeeDocumentAttach,
): Promise<EmployeeDocument> {
  return api.post<EmployeeDocument>(`/api/v1/workers/${workerId}/documents/`, body);
}

export function removeWorkerDocument(workerId: string, linkId: string): Promise<void> {
  return api.delete<void>(`/api/v1/workers/${workerId}/documents/${linkId}/`);
}

export function verifyWorkerDocument(
  workerId: string,
  linkId: string,
): Promise<EmployeeDocument> {
  return api.post<EmployeeDocument>(`/api/v1/workers/${workerId}/documents/${linkId}/verify/`);
}
