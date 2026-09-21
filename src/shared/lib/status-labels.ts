/**
 * Every closed string the UI is allowed to render as a badge, filter, or
 * empty-state (ARCHITECTURE.md §5). These sets come from the schema, not
 * from guessing at the API response — badges/filters use ONLY these values.
 * Status is never PATCHed directly; it moves only through the named act
 * (submit/approve/cancel/…), never a `<select>` bound to this field.
 */

function labels<T extends string>(map: Record<T, string>): Record<T, string> {
  return map;
}

// ---- accounts -------------------------------------------------------

export type UserStatus = "invited" | "active" | "deactivated";
export const USER_STATUS_LABELS = labels<UserStatus>({
  invited: "Invited",
  active: "Active",
  deactivated: "Deactivated",
});

// ---- clients ----------------------------------------------------------

export type ClientStatus = "prospect" | "active" | "inactive";
export const CLIENT_STATUS_LABELS = labels<ClientStatus>({
  prospect: "Prospect",
  active: "Active",
  inactive: "Inactive",
});

export type BillingCycle = "weekly" | "biweekly" | "monthly";
export const BILLING_CYCLE_LABELS = labels<BillingCycle>({
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
});

export type PaymentTerms = "due_on_receipt" | "net_15" | "net_30" | "net_60";
export const PAYMENT_TERMS_LABELS = labels<PaymentTerms>({
  due_on_receipt: "Due on receipt",
  net_15: "Net 15",
  net_30: "Net 30",
  net_60: "Net 60",
});

// ---- workers (employees) ----------------------------------------------

export type LifecycleStatus = "applicant" | "onboarding" | "active" | "out";
export const LIFECYCLE_STATUS_LABELS = labels<LifecycleStatus>({
  applicant: "Applicant",
  onboarding: "Onboarding",
  active: "Active",
  out: "Out",
});

export type WorkStatus = "available" | "on_shift" | "on_leave";
export const WORK_STATUS_LABELS = labels<WorkStatus>({
  available: "Available",
  on_shift: "On shift",
  on_leave: "On leave",
});

export type BackgroundCheckStatus = "not_done" | "good" | "not_good";
export const BACKGROUND_CHECK_STATUS_LABELS = labels<BackgroundCheckStatus>({
  not_done: "Not done",
  good: "Good",
  not_good: "Not good",
});

export type EmploymentType = "full_time" | "part_time" | "either";
export const EMPLOYMENT_TYPE_LABELS = labels<EmploymentType>({
  full_time: "Full-time",
  part_time: "Part-time",
  either: "Either",
});

export type WorkAuthorization = "citizen_pr" | "permit";
export const WORK_AUTHORIZATION_LABELS = labels<WorkAuthorization>({
  citizen_pr: "Citizen / PR",
  permit: "Work or study permit",
});

export type PayMethod = "etransfer" | "direct_deposit" | "cheque";
export const PAY_METHOD_LABELS = labels<PayMethod>({
  etransfer: "e-Transfer",
  direct_deposit: "Direct deposit",
  cheque: "Cheque",
});

export type NotificationChannelPref = "email" | "sms";
export const NOTIFICATION_CHANNEL_PREF_LABELS = labels<NotificationChannelPref>({
  email: "Email",
  sms: "SMS",
});

export type TimeOffType = "vacation" | "sick" | "personal" | "other";
export const TIME_OFF_TYPE_LABELS = labels<TimeOffType>({
  vacation: "Vacation",
  sick: "Sick",
  personal: "Personal",
  other: "Other",
});

export type IncidentType = "positive" | "negative";
export const INCIDENT_TYPE_LABELS = labels<IncidentType>({
  positive: "Positive",
  negative: "Negative",
});

// ---- jobs ---------------------------------------------------------------

export type JobStatus = "open" | "filled" | "cancelled" | "completed";
export const JOB_STATUS_LABELS = labels<JobStatus>({
  open: "Open",
  filled: "Filled",
  cancelled: "Cancelled",
  completed: "Completed",
});

export type BillRateUnit = "hr" | "day" | "flat";
export const BILL_RATE_UNIT_LABELS = labels<BillRateUnit>({
  hr: "Per hour",
  day: "Per day",
  flat: "Flat",
});

export type RequirementType = "skill" | "cert";
export const REQUIREMENT_TYPE_LABELS = labels<RequirementType>({
  skill: "Skill",
  cert: "Certification",
});

export type AssignmentStatus = "offered" | "confirmed";
export const ASSIGNMENT_STATUS_LABELS = labels<AssignmentStatus>({
  offered: "Offered",
  confirmed: "Confirmed",
});

export type ShiftStatus = "scheduled" | "worked" | "not_worked";
export const SHIFT_STATUS_LABELS = labels<ShiftStatus>({
  scheduled: "Scheduled",
  worked: "Worked",
  not_worked: "Not worked",
});

export type ShiftNotWorkedReason = "no_show" | "excused" | "client_cancelled";
export const SHIFT_NOT_WORKED_REASON_LABELS = labels<ShiftNotWorkedReason>({
  no_show: "No-show",
  excused: "Excused",
  client_cancelled: "Client cancelled",
});

// ---- hour sheets ----------------------------------------------------------

export type HourSheetStatus = "received" | "approved";
export const HOUR_SHEET_STATUS_LABELS = labels<HourSheetStatus>({
  received: "Received",
  approved: "Approved",
});

export type HourSheetSource = "manual" | "upload" | "email";
export const HOUR_SHEET_SOURCE_LABELS = labels<HourSheetSource>({
  manual: "Manual",
  upload: "Upload",
  email: "Email", // [P2]
});

export type MatchStatus = "unmatched" | "matched" | "ambiguous" | "blocked";
export const MATCH_STATUS_LABELS = labels<MatchStatus>({
  unmatched: "Unmatched",
  matched: "Matched",
  ambiguous: "Ambiguous",
  blocked: "Blocked",
});

// ---- money: invoices ----------------------------------------------------

export type InvoiceStatus = "draft" | "pending_approval" | "approved" | "sent";
export const INVOICE_STATUS_LABELS = labels<InvoiceStatus>({
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  sent: "Sent",
});

export type InvoiceLineUnit = "hour" | "day" | "flat";
export const INVOICE_LINE_UNIT_LABELS = labels<InvoiceLineUnit>({
  hour: "Hour",
  day: "Day",
  flat: "Flat",
});

export type TaxCode = "gst" | "hst" | "pst" | "qst";
export const TAX_CODE_LABELS = labels<TaxCode>({
  gst: "GST",
  hst: "HST",
  pst: "PST",
  qst: "QST",
});

// ---- money: payroll -------------------------------------------------------

export type PayrollRunStatus = "draft" | "approved";
export const PAYROLL_RUN_STATUS_LABELS = labels<PayrollRunStatus>({
  draft: "Draft",
  approved: "Approved",
});

/** UI copy says "pay statement" everywhere. */
export type PayStatementStatus = "draft" | "issued" | "paid";
export const PAY_STATEMENT_STATUS_LABELS = labels<PayStatementStatus>({
  draft: "Draft",
  issued: "Issued",
  paid: "Paid",
});
/** @deprecated Use PayStatementStatus */
export type PayslipStatus = PayStatementStatus;
/** @deprecated */
export const PAYSLIP_STATUS_LABELS = PAY_STATEMENT_STATUS_LABELS;

export type PayStatementLineType = "shift" | "bonus" | "adjustment" | "allowance" | "other";
export const PAY_STATEMENT_LINE_TYPE_LABELS = labels<PayStatementLineType>({
  shift: "Shift",
  bonus: "Bonus",
  adjustment: "Adjustment",
  allowance: "Allowance",
  other: "Other",
});
/** @deprecated */
export type PayslipLineType = PayStatementLineType;
/** @deprecated */
export const PAYSLIP_LINE_TYPE_LABELS = PAY_STATEMENT_LINE_TYPE_LABELS;

export type DeductionCode = "cpp" | "ei" | "federal_tax" | "provincial_tax" | "other";
export const DEDUCTION_CODE_LABELS = labels<DeductionCode>({
  cpp: "CPP",
  ei: "EI",
  federal_tax: "Federal tax",
  provincial_tax: "Provincial tax",
  other: "Other",
});

// ---- esign ----------------------------------------------------------------

export type SignatureRequestStatus = "pending" | "signed" | "declined" | "revoked";
export const SIGNATURE_REQUEST_STATUS_LABELS = labels<SignatureRequestStatus>({
  pending: "Pending",
  signed: "Signed",
  declined: "Declined",
  revoked: "Revoked",
});

export type SignatureRequestPurpose = "payroll_release" | "onboarding";
export const SIGNATURE_REQUEST_PURPOSE_LABELS = labels<SignatureRequestPurpose>({
  payroll_release: "Payroll release",
  onboarding: "Onboarding",
});

// ---- tasks ------------------------------------------------------------

export type TaskStatus = "open" | "done";
export const TASK_STATUS_LABELS = labels<TaskStatus>({
  open: "Open",
  done: "Done",
});

export type TaskType =
  | "custom"
  | "job"
  | "client_followup"
  | "employee_followup"
  | "cert_renewal"
  | "invoice_approval"
  | "privacy_request"
  | "permit_renewal"
  | "client_notice_approval";
export const TASK_TYPE_LABELS = labels<TaskType>({
  custom: "Custom",
  job: "Job",
  client_followup: "Client follow-up",
  employee_followup: "Employee follow-up",
  cert_renewal: "Certification renewal",
  invoice_approval: "Invoice approval",
  privacy_request: "Privacy request",
  permit_renewal: "Permit renewal",
  client_notice_approval: "Client notice approval",
});

/** State-mirrored types: the UI refuses a manual Complete — the linked
 * act is what closes them (ARCHITECTURE.md §5.1). */
export const MIRRORED_TASK_TYPES: readonly TaskType[] = [
  "invoice_approval",
  "privacy_request",
  "client_notice_approval",
];

// ---- notifications ----------------------------------------------------

export type NotificationStatus = "queued" | "sent" | "read";
export const NOTIFICATION_STATUS_LABELS = labels<NotificationStatus>({
  queued: "Queued",
  sent: "Sent",
  read: "Read",
});

export type NotificationType = "shift_offer" | "esign" | "cert_expiry" | "task" | "invoice";
export const NOTIFICATION_TYPE_LABELS = labels<NotificationType>({
  shift_offer: "Shift offer",
  esign: "E-sign",
  cert_expiry: "Certification expiry",
  task: "Task",
  invoice: "Invoice",
});

export type NotificationChannel = "email" | "in_app" | "sms";
export const NOTIFICATION_CHANNEL_LABELS = labels<NotificationChannel>({
  email: "Email",
  in_app: "In-app",
  sms: "SMS", // not yet built
});

// ---- privacy ------------------------------------------------------------

export type ConsentSource = "portal" | "staff";
export const CONSENT_SOURCE_LABELS = labels<ConsentSource>({
  portal: "Portal",
  staff: "Staff",
});

export type PrivacyRequestType = "access" | "correction";
export const PRIVACY_REQUEST_TYPE_LABELS = labels<PrivacyRequestType>({
  access: "Access",
  correction: "Correction",
});

export type PrivacyRequestStatus = "open" | "answered";
export const PRIVACY_REQUEST_STATUS_LABELS = labels<PrivacyRequestStatus>({
  open: "Open",
  answered: "Answered",
});

// ---- candidate imports --------------------------------------------------

export type CandidateImportBatchStatus =
  | "uploaded"
  | "validating"
  | "validated"
  | "failed"
  | "committing"
  | "committed"
  | "committed_with_errors";
export const CANDIDATE_IMPORT_BATCH_STATUS_LABELS = labels<CandidateImportBatchStatus>({
  uploaded: "Uploaded",
  validating: "Validating",
  validated: "Validated",
  failed: "Failed",
  committing: "Committing",
  committed: "Committed",
  committed_with_errors: "Committed with errors",
});

export type CandidateImportRowMatchStatus = "valid" | "invalid" | "duplicate";
export const CANDIDATE_IMPORT_ROW_MATCH_STATUS_LABELS = labels<CandidateImportRowMatchStatus>({
  valid: "Valid",
  invalid: "Invalid",
  duplicate: "Duplicate",
});

export type CandidateImportDocumentMatchStatus = "matched" | "unmatched" | "ambiguous";
export const CANDIDATE_IMPORT_DOCUMENT_MATCH_STATUS_LABELS =
  labels<CandidateImportDocumentMatchStatus>({
    matched: "Matched",
    unmatched: "Unmatched",
    ambiguous: "Ambiguous",
  });

// ---- documents ----------------------------------------------------------

export type DocumentType =
  | "gov_id"
  | "cert"
  | "hour_sheet"
  | "payslip"
  | "invoice"
  | "signed_form"
  | "esign_form"
  | "org_logo"
  | "resume"
  | "sin_document"
  | "work_permit"
  | "study_permit"
  | "other";
export const DOCUMENT_TYPE_LABELS = labels<DocumentType>({
  gov_id: "Government ID",
  cert: "Certification",
  hour_sheet: "Hour sheet",
  payslip: "Pay statement",
  invoice: "Invoice",
  signed_form: "Signed form",
  esign_form: "E-sign form",
  org_logo: "Organization logo",
  resume: "Résumé",
  sin_document: "SIN document",
  work_permit: "Work permit",
  study_permit: "Study permit",
  other: "Other",
});

/** PII-class document types (ARCHITECTURE.md §9) — masked handling applies. */
export const PII_DOCUMENT_TYPES: readonly DocumentType[] = ["gov_id", "sin_document"];

/** The generic documents UI never lists these — they ride their own
 * money/esign screens instead (ARCHITECTURE.md §5.1). */
export const NON_GENERIC_DOCUMENT_TYPES: readonly DocumentType[] = [
  "invoice",
  "payslip",
  "signed_form",
  "esign_form",
];
