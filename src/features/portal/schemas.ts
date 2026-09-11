import { z } from "zod";

const optionalStr = (max: number) => z.string().max(max).optional().or(z.literal(""));

/** The worker's own editable subset — narrower than the staff
 * WorkerProfileForm (no first/last name, pronouns, pay method, work
 * status — PatchedPortalMeWrite's own field list). */
export const portalProfileSchema = z.object({
  email: z.string().email("Enter a valid email.").max(254).optional().or(z.literal("")),
  phone: optionalStr(24),
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
  notification_channel: z.enum(["email", "sms"]).optional(),
  referral_source: optionalStr(255),
});

export type PortalProfileFormValues = z.infer<typeof portalProfileSchema>;

// Certs/skills/availability/education/employment-history/time-off reuse the
// staff-side schemas as-is — the portal doors accept the identical write
// shapes (workers/schemas.ts).
export {
  availabilitySchema as portalAvailabilitySchema,
  certSchema as portalCertSchema,
  educationSchema as portalEducationSchema,
  employmentHistorySchema as portalEmploymentHistorySchema,
  skillLinkSchema as portalSkillLinkSchema,
  timeOffSchema as portalTimeOffSchema,
  type AvailabilityFormValues as PortalAvailabilityFormValues,
  type CertFormValues as PortalCertFormValues,
  type EducationFormValues as PortalEducationFormValues,
  type EmploymentHistoryFormValues as PortalEmploymentHistoryFormValues,
  type SkillLinkFormValues as PortalSkillLinkFormValues,
  type TimeOffFormValues as PortalTimeOffFormValues,
} from "@/features/workers/schemas";
