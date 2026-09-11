import { api, type Paginated } from "@/api/client";
import { resourceKeys } from "@/api/query-keys";
import type {
  AssignmentDetail,
  HourSheet,
  HourSheetLine,
  Job,
  JobAssignment,
  JobRequirement,
  JobShiftPattern,
  Shift,
} from "@/features/jobs/types";

export const jobKeys = resourceKeys("jobs");
export const shiftKeys = resourceKeys("shifts");
export const hourSheetKeys = resourceKeys("hour-sheets");

export interface ListJobsParams {
  page?: number;
  pageSize?: number;
  status?: string;
  client?: string;
}

function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listJobs(params: ListJobsParams = {}): Promise<Paginated<Job>> {
  return api.get<Paginated<Job>>(
    `/api/v1/jobs/${toQuery({ page: params.page, page_size: params.pageSize, status: params.status, client: params.client })}`,
  );
}

export function getJob(id: string): Promise<Job> {
  return api.get<Job>(`/api/v1/jobs/${id}/`);
}

export function listJobRequirements(jobId: string): Promise<JobRequirement[]> {
  return api.get<JobRequirement[]>(`/api/v1/jobs/${jobId}/requirements/`);
}

export function listJobShiftPatterns(jobId: string): Promise<JobShiftPattern[]> {
  return api.get<JobShiftPattern[]>(`/api/v1/jobs/${jobId}/shift-patterns/`);
}

export function listJobAssignments(jobId: string): Promise<JobAssignment[]> {
  return api.get<JobAssignment[]>(`/api/v1/jobs/${jobId}/assignments/`);
}

export function getAssignment(id: string): Promise<AssignmentDetail> {
  return api.get<AssignmentDetail>(`/api/v1/assignments/${id}/`);
}

export interface ListShiftsParams {
  page?: number;
  pageSize?: number;
  job?: string;
  employee?: string;
  from?: string;
  to?: string;
}

export function listShifts(params: ListShiftsParams = {}): Promise<Paginated<Shift>> {
  return api.get<Paginated<Shift>>(
    `/api/v1/shifts/${toQuery({
      page: params.page,
      page_size: params.pageSize,
      job: params.job,
      employee: params.employee,
      from: params.from,
      to: params.to,
    })}`,
  );
}

export function getShift(id: string): Promise<Shift> {
  return api.get<Shift>(`/api/v1/shifts/${id}/`);
}

export interface ListHourSheetsParams {
  page?: number;
  pageSize?: number;
  status?: string;
  job?: string;
  client?: string;
}

export function listHourSheets(params: ListHourSheetsParams = {}): Promise<Paginated<HourSheet>> {
  return api.get<Paginated<HourSheet>>(
    `/api/v1/hour-sheets/${toQuery({
      page: params.page,
      page_size: params.pageSize,
      status: params.status,
      job: params.job,
      client: params.client,
    })}`,
  );
}

export function getHourSheet(id: string): Promise<HourSheet> {
  return api.get<HourSheet>(`/api/v1/hour-sheets/${id}/`);
}

export function listHourSheetLines(sheetId: string): Promise<HourSheetLine[]> {
  return api.get<HourSheetLine[]>(`/api/v1/hour-sheets/${sheetId}/lines/`);
}
