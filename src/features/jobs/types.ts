import type { components } from "@openapi/schema";

export type Job = components["schemas"]["Job"];
export type JobWrite = components["schemas"]["JobWrite"];
/** The PATCH-only shape — unlike JobWrite (create), this one also carries
 * `status`: completing a job (and reopening a cancelled one) goes through
 * this same door, per jobs/services.py's update_job. `client` is
 * deliberately absent here — not movable after creation. */
export type JobUpdate = components["schemas"]["PatchedJobUpdate"];
export type JobRequirement = components["schemas"]["JobRequirement"];
export type JobRequirementWrite = components["schemas"]["JobRequirementWrite"];
export type JobShiftPattern = components["schemas"]["JobShiftPattern"];
export type JobShiftPatternWrite = components["schemas"]["JobShiftPatternWrite"];

export type JobAssignment = components["schemas"]["JobAssignment"];
export type AssignmentDetail = components["schemas"]["AssignmentDetail"];
export type JobAssignmentWrite = components["schemas"]["JobAssignmentWrite"];

export type Shift = components["schemas"]["Shift"];
export type ShiftWrite = components["schemas"]["ShiftWrite"];
export type ShiftMark = components["schemas"]["ShiftMark"];

export type HourSheet = components["schemas"]["HourSheet"];
export type HourSheetWrite = components["schemas"]["HourSheetWrite"];
export type HourSheetLine = components["schemas"]["HourSheetLine"];
export type HourSheetLineWrite = components["schemas"]["HourSheetLineWrite"];
