import { z } from "zod";
import { optionalNumber } from "@/shared/lib/zod-helpers";

export const DAYS_OF_WEEK = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
] as const;

const optionalStr = (max: number) => z.string().max(max).optional().or(z.literal(""));

/** Worker profile — create/edit (ARCHITECTURE.md: rating and
 * lifecycle_status are never here, transitioned only through the named
 * acts; background_check has its own door/form). */
export const workerProfileSchema = z.object({
  first_name: z.string().min(1, "First name is required.").max(150),
  last_name: z.string().min(1, "Last name is required.").max(150),
  email: z.string().email("Enter a valid email.").max(254).optional().or(z.literal("")),
  phone: optionalStr(24),
  pronouns: optionalStr(64),
  address_line_1: optionalStr(255),
  address_line_2: optionalStr(255),
  city: optionalStr(128),
  province: z
    .enum(["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT", ""])
    .optional(),
  postal_code: optionalStr(7),
  emergency_contact_name: optionalStr(150),
  emergency_contact_phone: optionalStr(24),
  employment_type: z.enum(["full_time", "part_time", "either", ""]).optional(),
  work_authorization: z.enum(["citizen_pr", "permit", ""]).optional(),
  work_status: z.enum(["available", "on_shift", "on_leave", ""]).optional(),
  pay_method: z.enum(["etransfer", "direct_deposit", "cheque", ""]).optional(),
  notification_channel: z.enum(["email", "sms"]).optional(),
  referral_source: optionalStr(255),
});

export type WorkerProfileFormValues = z.infer<typeof workerProfileSchema>;

/** PII edit — only the fields the caller sends are written (each field
 * gates independently server-side, pii.*.edit — ARCHITECTURE.md §9). */
export const personalSchema = z.object({
  sin: z.string().optional().or(z.literal("")),
  dob: z.string().optional().or(z.literal("")),
  bank_transit: z.string().optional().or(z.literal("")),
  bank_account: z.string().optional().or(z.literal("")),
});

export type PersonalFormValues = z.infer<typeof personalSchema>;

export const backgroundCheckSchema = z.object({
  status: z.enum(["not_done", "good", "not_good"]),
  note: optionalStr(1000),
});

export type BackgroundCheckFormValues = z.infer<typeof backgroundCheckSchema>;

export const certSchema = z.object({
  name: z.string().min(1, "Name is required.").max(150),
  issued: z.string().optional().or(z.literal("")),
  expiry: z.string().optional().or(z.literal("")),
});

export type CertFormValues = z.infer<typeof certSchema>;

export const availabilitySchema = z.object({
  day_of_week: z.coerce.number().int().min(1).max(7),
  start_time: z.string().min(1, "Start time is required."),
  end_time: z.string().min(1, "End time is required."),
});

export type AvailabilityFormValues = z.infer<typeof availabilitySchema>;

export const educationSchema = z.object({
  institution: z.string().min(1, "Institution is required.").max(255),
  credential: z.string().min(1, "Credential is required.").max(150),
  year: optionalNumber(z.coerce.number().int().min(1950).max(2100)),
  completed: z.boolean().optional(),
});

export type EducationFormValues = z.infer<typeof educationSchema>;

export const employmentHistorySchema = z.object({
  employer_name: z.string().min(1, "Employer name is required.").max(255),
  job_title: optionalStr(150),
  started_on: z.string().optional().or(z.literal("")),
  ended_on: z.string().optional().or(z.literal("")),
  supervisor_name: optionalStr(150),
  supervisor_phone: optionalStr(24),
  supervisor_email: z.string().email("Enter a valid email.").max(254).optional().or(z.literal("")),
});

export type EmploymentHistoryFormValues = z.infer<typeof employmentHistorySchema>;

export const timeOffSchema = z.object({
  type: z.enum(["vacation", "sick", "personal", "other"]),
  start_date: z.string().min(1, "Start date is required."),
  end_date: z.string().min(1, "End date is required."),
});

export type TimeOffFormValues = z.infer<typeof timeOffSchema>;

export const incidentLogSchema = z.object({
  category: z.string().min(1, "Category is required.").max(64),
  occurred_at: z.string().min(1, "Date/time is required."),
  note: optionalStr(2000),
});

export type IncidentLogFormValues = z.infer<typeof incidentLogSchema>;

export const incidentVoidSchema = z.object({
  reason: z.string().min(1, "A reason is required."),
});

export type IncidentVoidFormValues = z.infer<typeof incidentVoidSchema>;

export const skillLinkSchema = z.object({
  skill_id: z.string().min(1, "Pick a skill."),
  // A decimal STRING like markup_pct — never a number (never float-drift
  // on a value the API stores as fixed-scale numeric).
  years_exp: z
    .string()
    .regex(/^-?\d{0,3}(?:\.\d{0,1})?$/, "Enter a number like 2 or 2.5.")
    .optional()
    .or(z.literal("")),
});

export type SkillLinkFormValues = z.infer<typeof skillLinkSchema>;
