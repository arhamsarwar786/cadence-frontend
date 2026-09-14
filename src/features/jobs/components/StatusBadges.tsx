import type { BadgeTone } from "@/shared/ui";
import { Badge } from "@/shared/ui";
import {
  ASSIGNMENT_STATUS_LABELS,
  HOUR_SHEET_STATUS_LABELS,
  JOB_STATUS_LABELS,
  SHIFT_STATUS_LABELS,
  type AssignmentStatus,
  type HourSheetStatus,
  type JobStatus,
  type ShiftStatus,
} from "@/shared/lib/status-labels";

const JOB_TONE: Record<JobStatus, BadgeTone> = {
  open: "info",
  filled: "positive",
  cancelled: "negative",
  completed: "neutral",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <Badge tone={JOB_TONE[status]} tooltip={`Job: ${JOB_STATUS_LABELS[status]}`}>
      {JOB_STATUS_LABELS[status]}
    </Badge>
  );
}

const SHIFT_TONE: Record<ShiftStatus, BadgeTone> = {
  scheduled: "info",
  worked: "positive",
  not_worked: "negative",
};

export function ShiftStatusBadge({ status }: { status: ShiftStatus }) {
  return (
    <Badge tone={SHIFT_TONE[status]} tooltip={`Shift: ${SHIFT_STATUS_LABELS[status]}`}>
      {SHIFT_STATUS_LABELS[status]}
    </Badge>
  );
}

const HOUR_SHEET_TONE: Record<HourSheetStatus, BadgeTone> = {
  received: "info",
  approved: "positive",
};

export function HourSheetStatusBadge({ status }: { status: HourSheetStatus }) {
  return (
    <Badge tone={HOUR_SHEET_TONE[status]} tooltip={`Hour sheet: ${HOUR_SHEET_STATUS_LABELS[status]}`}>
      {HOUR_SHEET_STATUS_LABELS[status]}
    </Badge>
  );
}

const ASSIGNMENT_TONE: Record<AssignmentStatus, BadgeTone> = {
  offered: "info",
  confirmed: "positive",
};

export function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  return (
    <Badge tone={ASSIGNMENT_TONE[status]} tooltip={`Placement: ${ASSIGNMENT_STATUS_LABELS[status]}`}>
      {ASSIGNMENT_STATUS_LABELS[status]}
    </Badge>
  );
}
