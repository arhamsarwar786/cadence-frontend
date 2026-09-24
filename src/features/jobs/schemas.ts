import { z } from "zod";
import { optionalNumber } from "@/shared/lib/zod-helpers";

const decimalStr = (maxIntDigits: number) =>
  z
    .string()
    .min(1, "Required.")
    .regex(new RegExp(`^-?\\d{0,${maxIntDigits}}(?:\\.\\d{0,2})?$`), "Enter a valid number.");

const optionalDecimalStr = (maxIntDigits: number) =>
  z
    .string()
    .regex(new RegExp(`^-?\\d{0,${maxIntDigits}}(?:\\.\\d{0,2})?$`), "Enter a valid number.")
    .optional()
    .or(z.literal(""));

/** Bill rate is required on create only when the caller has jobs.bill_rate.edit. */
export function jobFormSchema(requireBillRate: boolean) {
  return z.object({
  title: z.string().min(1, "Title is required.").max(200),
  client: z.string().min(1, "Pick a client."),
  status: z.enum(["open", "filled", "cancelled", "completed"]).optional(),
  bill_rate: requireBillRate ? decimalStr(8) : optionalDecimalStr(8),
  bill_rate_unit: z.enum(["hr", "day", "flat"]),
  markup_pct: z
    .string()
    .regex(/^-?\d{0,3}(?:\.\d{0,2})?$/, "Enter a number like 35 or 35.00.")
    .optional()
    .or(z.literal("")),
  headcount_needed: optionalNumber(z.coerce.number().int().min(1)),
  start_datetime: z.string().min(1, "Start is required."),
  end_datetime: z.string().min(1, "End is required."),
  po_number: z.string().max(64).optional().or(z.literal("")),
  invoice_date: z.string().optional().or(z.literal("")),
  });
}

export const jobSchema = jobFormSchema(true);

export type JobFormValues = z.infer<ReturnType<typeof jobFormSchema>>;

export const requirementSchema = z.object({
  requirement_type: z.enum(["skill", "cert"]),
  skill_id: z.string().optional().or(z.literal("")),
  cert_name: z.string().max(255).optional().or(z.literal("")),
  // A decimal STRING like markup_pct/years_exp — never a number.
  min_years: z
    .string()
    .regex(/^\d{0,3}(?:\.\d{0,1})?$/, "Enter a number like 2 or 2.5.")
    .optional()
    .or(z.literal("")),
});

export type RequirementFormValues = z.infer<typeof requirementSchema>;

export const shiftPatternSchema = z.object({
  days_of_week: z.array(z.coerce.number().int().min(1).max(7)).min(1, "Pick at least one day."),
  start_time: z.string().min(1, "Start time is required."),
  end_time: z.string().min(1, "End time is required."),
  break_minutes: optionalNumber(z.coerce.number().int().min(0)),
});

export type ShiftPatternFormValues = z.infer<typeof shiftPatternSchema>;

export const hourSheetSchema = z.object({
  client_id: z.string().min(1, "Pick a client."),
  job_id: z.string().optional().or(z.literal("")),
  period_start: z.string().min(1, "Start date is required."),
  period_end: z.string().min(1, "End date is required."),
});

export type HourSheetFormValues = z.infer<typeof hourSheetSchema>;

export const hourSheetLineSchema = z.object({
  employee_id: z.string().min(1, "Pick an employee."),
  work_date: z.string().optional().or(z.literal("")),
  hours: decimalStr(3),
  range_from: z.string().optional().or(z.literal("")),
  range_to: z.string().optional().or(z.literal("")),
  raw_text: z.string().optional().or(z.literal("")),
});

export type HourSheetLineFormValues = z.infer<typeof hourSheetLineSchema>;

export const shiftMarkSchema = z.object({
  reason: z.enum(["no_show", "excused", "client_cancelled"]),
});

export type ShiftMarkFormValues = z.infer<typeof shiftMarkSchema>;
