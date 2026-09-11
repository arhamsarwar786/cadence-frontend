import { api, type Paginated } from "@/api/client";
import { resourceKeys } from "@/api/query-keys";
import type {
  Employee,
  EmployeeAvailability,
  EmployeeCert,
  EmployeeDocument,
  EmployeeEducation,
  EmployeeList,
  EmployeeSkill,
  EmployeeTimeOff,
  EmploymentHistory,
  GovIdDocumentIds,
  IncidentWeight,
  PersonalReveal,
  Skill,
  WorkerIncident,
} from "@/features/workers/types";

export const workerKeys = resourceKeys("workers");

export interface ListWorkersParams {
  page?: number;
  pageSize?: number;
}

export function listWorkers(params: ListWorkersParams = {}): Promise<Paginated<EmployeeList>> {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("page_size", String(params.pageSize));
  const qs = search.toString();
  return api.get<Paginated<EmployeeList>>(`/api/v1/workers/${qs ? `?${qs}` : ""}`);
}

export function getWorker(id: string): Promise<Employee> {
  return api.get<Employee>(`/api/v1/workers/${id}/`);
}

export function getPersonalField(workerId: string, field: string): Promise<PersonalReveal> {
  return api.get<PersonalReveal>(`/api/v1/workers/${workerId}/personal/${field}/`);
}

export function getGovIdDocumentIds(workerId: string): Promise<GovIdDocumentIds> {
  return api.get<GovIdDocumentIds>(`/api/v1/workers/${workerId}/personal/gov-id/`);
}

export function listWorkerCerts(workerId: string): Promise<EmployeeCert[]> {
  return api.get<EmployeeCert[]>(`/api/v1/workers/${workerId}/certs/`);
}

export function listSkillsCatalog(): Promise<Skill[]> {
  return api.get<Skill[]>("/api/v1/workers/skills/");
}

export function listWorkerSkills(workerId: string): Promise<EmployeeSkill[]> {
  return api.get<EmployeeSkill[]>(`/api/v1/workers/${workerId}/skills/`);
}

export function listWorkerAvailability(workerId: string): Promise<EmployeeAvailability[]> {
  return api.get<EmployeeAvailability[]>(`/api/v1/workers/${workerId}/availability/`);
}

export function listWorkerEducation(workerId: string): Promise<EmployeeEducation[]> {
  return api.get<EmployeeEducation[]>(`/api/v1/workers/${workerId}/education/`);
}

export function listWorkerEmploymentHistory(workerId: string): Promise<EmploymentHistory[]> {
  return api.get<EmploymentHistory[]>(`/api/v1/workers/${workerId}/employment-history/`);
}

export function listWorkerTimeOff(workerId: string): Promise<EmployeeTimeOff[]> {
  return api.get<EmployeeTimeOff[]>(`/api/v1/workers/${workerId}/time-off/`);
}

/** Unlike the other per-employee children, incidents can accumulate over
 * years and is genuinely paginated (PaginatedWorkerIncidentList) — not a
 * bare array. */
export function listWorkerIncidents(
  workerId: string,
  page = 1,
): Promise<Paginated<WorkerIncident>> {
  return api.get<Paginated<WorkerIncident>>(
    `/api/v1/workers/${workerId}/incidents/?page=${page}`,
  );
}

export function listIncidentWeights(): Promise<IncidentWeight[]> {
  return api.get<IncidentWeight[]>("/api/v1/workers/incident-weights/");
}

export function listWorkerDocuments(workerId: string): Promise<EmployeeDocument[]> {
  return api.get<EmployeeDocument[]>(`/api/v1/workers/${workerId}/documents/`);
}
