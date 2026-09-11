import { api } from "@/api/client";
import type {
  AssignmentDetail,
  HourSheet,
  HourSheetLine,
  HourSheetLineWrite,
  HourSheetWrite,
  Job,
  JobAssignment,
  JobAssignmentWrite,
  JobRequirement,
  JobRequirementWrite,
  JobShiftPattern,
  JobShiftPatternWrite,
  JobUpdate,
  JobWrite,
  Shift,
  ShiftMark,
  ShiftWrite,
} from "@/features/jobs/types";

// --- Jobs ------------------------------------------------------------

export function createJob(body: JobWrite): Promise<Job> {
  return api.post<Job>("/api/v1/jobs/", body);
}

export function updateJob(id: string, body: JobUpdate): Promise<Job> {
  return api.patch<Job>(`/api/v1/jobs/${id}/`, body);
}

/** open|filled -> completed (ARCHITECTURE.md §5.2). Not a dedicated
 * endpoint — the status field rides the same PATCH door as any other
 * edit (jobs/services.py's update_job accepts it explicitly). */
export function completeJob(id: string): Promise<Job> {
  return api.patch<Job>(`/api/v1/jobs/${id}/`, { status: "completed" });
}

/** Soft-delete/archive — one of the four archive-UX tables
 * (AGENTS.md invariants), never a hard delete. */
export function deleteJob(id: string): Promise<void> {
  return api.delete<void>(`/api/v1/jobs/${id}/`);
}

export function cancelJob(id: string): Promise<Job> {
  return api.post<Job>(`/api/v1/jobs/${id}/cancel/`);
}

export function regenerateShifts(jobId: string): Promise<void> {
  return api.post<void>(`/api/v1/jobs/${jobId}/shifts/regenerate/`);
}

// --- Requirements --------------------------------------------------------

export function addRequirement(
  jobId: string,
  body: JobRequirementWrite,
): Promise<JobRequirement> {
  return api.post<JobRequirement>(`/api/v1/jobs/${jobId}/requirements/`, body);
}

export function updateRequirement(
  jobId: string,
  requirementId: string,
  body: Partial<JobRequirementWrite>,
): Promise<JobRequirement> {
  return api.patch<JobRequirement>(
    `/api/v1/jobs/${jobId}/requirements/${requirementId}/`,
    body,
  );
}

export function deleteRequirement(jobId: string, requirementId: string): Promise<void> {
  return api.delete<void>(`/api/v1/jobs/${jobId}/requirements/${requirementId}/`);
}

// --- Shift patterns --------------------------------------------------

export function addShiftPattern(
  jobId: string,
  body: JobShiftPatternWrite,
): Promise<JobShiftPattern> {
  return api.post<JobShiftPattern>(`/api/v1/jobs/${jobId}/shift-patterns/`, body);
}

export function updateShiftPattern(
  jobId: string,
  patternId: string,
  body: Partial<JobShiftPatternWrite>,
): Promise<JobShiftPattern> {
  return api.patch<JobShiftPattern>(
    `/api/v1/jobs/${jobId}/shift-patterns/${patternId}/`,
    body,
  );
}

export function deleteShiftPattern(jobId: string, patternId: string): Promise<void> {
  return api.delete<void>(`/api/v1/jobs/${jobId}/shift-patterns/${patternId}/`);
}

// --- Assignments -----------------------------------------------------

export function createAssignment(
  jobId: string,
  body: JobAssignmentWrite,
): Promise<AssignmentDetail> {
  return api.post<AssignmentDetail>(`/api/v1/jobs/${jobId}/assignments/`, body);
}

/** Decline/withdraw is DELETE, never a third status
 * (ARCHITECTURE.md §5.1). */
export function withdrawAssignment(id: string): Promise<void> {
  return api.delete<void>(`/api/v1/assignments/${id}/`);
}

export function confirmAssignment(id: string): Promise<AssignmentDetail> {
  return api.post<AssignmentDetail>(`/api/v1/assignments/${id}/confirm/`);
}

export function refreshAssignmentRate(id: string): Promise<JobAssignment> {
  return api.post<JobAssignment>(`/api/v1/assignments/${id}/refresh-rate/`);
}

export function createShiftForAssignment(
  assignmentId: string,
  body: ShiftWrite,
): Promise<Shift> {
  return api.post<Shift>(`/api/v1/assignments/${assignmentId}/shifts/`, body);
}

// --- Shifts ------------------------------------------------------------

export function updateShift(id: string, body: Partial<ShiftWrite>): Promise<Shift> {
  return api.patch<Shift>(`/api/v1/shifts/${id}/`, body);
}

export function deleteShift(id: string): Promise<void> {
  return api.delete<void>(`/api/v1/shifts/${id}/`);
}

/** Nothing auto-flips a shift to worked/not_worked — this human mark is
 * the one exception (ARCHITECTURE.md §5.1). */
export function markShiftNotWorked(id: string, body: ShiftMark): Promise<Shift> {
  return api.post<Shift>(`/api/v1/shifts/${id}/mark-not-worked/`, body);
}

export function clearShiftMark(id: string): Promise<Shift> {
  return api.post<Shift>(`/api/v1/shifts/${id}/clear-mark/`);
}

// --- Hour sheets ----------------------------------------------------

export function createHourSheet(body: HourSheetWrite): Promise<HourSheet> {
  return api.post<HourSheet>("/api/v1/hour-sheets/", body);
}

export function uploadHourSheet(
  file: File,
  fields: { client_id: string; job_id?: string; period_start: string; period_end: string },
): Promise<HourSheet> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("client_id", fields.client_id);
  if (fields.job_id) formData.append("job_id", fields.job_id);
  formData.append("period_start", fields.period_start);
  formData.append("period_end", fields.period_end);
  return api.post<HourSheet>("/api/v1/hour-sheets/upload/", formData);
}

export function updateHourSheet(id: string, body: Partial<HourSheetWrite>): Promise<HourSheet> {
  return api.patch<HourSheet>(`/api/v1/hour-sheets/${id}/`, body);
}

export function deleteHourSheet(id: string): Promise<void> {
  return api.delete<void>(`/api/v1/hour-sheets/${id}/`);
}

/** Only if every line is matched (ARCHITECTURE.md §5.2) — the form
 * re-checks server-side regardless of what the button shows. */
export function approveHourSheet(id: string): Promise<HourSheet> {
  return api.post<HourSheet>(`/api/v1/hour-sheets/${id}/approve/`);
}

export function unapproveHourSheet(id: string): Promise<HourSheet> {
  return api.post<HourSheet>(`/api/v1/hour-sheets/${id}/unapprove/`);
}

export function addHourSheetLine(
  sheetId: string,
  body: HourSheetLineWrite,
): Promise<HourSheetLine> {
  return api.post<HourSheetLine>(`/api/v1/hour-sheets/${sheetId}/lines/`, body);
}

export function updateHourSheetLine(
  sheetId: string,
  lineId: string,
  body: Partial<HourSheetLineWrite>,
): Promise<HourSheetLine> {
  return api.patch<HourSheetLine>(`/api/v1/hour-sheets/${sheetId}/lines/${lineId}/`, body);
}

export function deleteHourSheetLine(sheetId: string, lineId: string): Promise<void> {
  return api.delete<void>(`/api/v1/hour-sheets/${sheetId}/lines/${lineId}/`);
}
