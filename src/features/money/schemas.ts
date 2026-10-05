import { z } from "zod";

const decimalStr = (maxIntDigits: number) =>
  z
    .string()
    .min(1, "Required.")
    .regex(new RegExp(`^-?\\d{0,${maxIntDigits}}(?:\\.\\d{0,2})?$`), "Enter a valid number.");

export const invoiceCreateSchema = z.object({
  client_id: z.string().min(1, "Pick a client."),
  issue_date: z.string().optional().or(z.literal("")),
  due_date: z.string().optional().or(z.literal("")),
  po_number: z.string().max(64).optional().or(z.literal("")),
});

export type InvoiceCreateFormValues = z.infer<typeof invoiceCreateSchema>;

export const autofillSchema = z.object({
  date_from: z.string().optional().or(z.literal("")),
  date_to: z.string().optional().or(z.literal("")),
  job_id: z.string().optional().or(z.literal("")),
});

export type AutofillFormValues = z.infer<typeof autofillSchema>;

export const invoiceLineSchema = z.object({
  description: z.string().min(1, "Description is required."),
  unit: z.enum(["hour", "day", "flat"]),
  quantity: decimalStr(10),
  rate: decimalStr(10),
  tax_exempt: z.boolean().optional(),
});

export type InvoiceLineFormValues = z.infer<typeof invoiceLineSchema>;

export const payrollRunCreateSchema = z
  .object({
    period_start: z.string().min(1, "Start date is required."),
    period_end: z.string().min(1, "End date is required."),
    payday: z.string().min(1, "Payday is required."),
  })
  .superRefine((values, ctx) => {
    if (values.period_start && values.period_end && values.period_end < values.period_start) {
      ctx.addIssue({
        code: "custom",
        path: ["period_end"],
        message: "Period end cannot precede the start.",
      });
    }
    if (values.period_end && values.payday && values.payday < values.period_end) {
      ctx.addIssue({
        code: "custom",
        path: ["payday"],
        message: "Payday cannot precede the period end.",
      });
    }
  });

export type PayrollRunCreateFormValues = z.infer<typeof payrollRunCreateSchema>;

export const payslipLineSchema = z.object({
  type: z.enum(["shift", "bonus", "adjustment", "allowance", "other"]),
  description: z.string().optional().or(z.literal("")),
  amount: decimalStr(10),
  hours: decimalStr(5).optional().or(z.literal("")),
  rate: decimalStr(10).optional().or(z.literal("")),
});

export type PayslipLineFormValues = z.infer<typeof payslipLineSchema>;

export const payslipDeductionSchema = z.object({
  code: z.enum(["cpp", "ei", "federal_tax", "provincial_tax", "other"]),
  label: z.string().min(1, "Label is required."),
  amount: decimalStr(10),
});

export type PayslipDeductionFormValues = z.infer<typeof payslipDeductionSchema>;

export const placementCreateSchema = z.object({
  client_id: z.string().min(1, "Pick a client."),
  employee_id: z.string().min(1, "Pick a worker."),
  job_id: z.string().optional().or(z.literal("")),
  annual_salary: decimalStr(10),
  fee_pct: z
    .string()
    .min(1, "Required.")
    .regex(/^\d{0,2}(?:\.\d{0,2})?$/, "Enter a percentage like 15 or 12.5."),
});

export type PlacementCreateFormValues = z.infer<typeof placementCreateSchema>;

/** A positive amount in dollars — the API's rate field (8 whole digits, 2 decimals, at least 0.01). */
const positiveAmount = z
  .string()
  .trim()
  .min(1, "Enter an amount.")
  .regex(/^\d{1,8}(?:\.\d{1,2})?$/, "Enter an amount like 25 or 25.50.")
  .refine((value) => !/^0+(?:\.0*)?$/.test(value), "The amount must be more than zero.");

export const creditNoteLineSchema = z.object({
  description: z.string().trim().min(1, "Describe what is being credited."),
  amount: positiveAmount,
  tax_exempt: z.boolean(),
});

export const creditNoteCreateSchema = z.object({
  invoice_id: z.string().min(1, "Pick the invoice to credit."),
  reason: z.string().trim().min(1, "Say why the client is being credited."),
  issue_date: z.string().optional().or(z.literal("")),
  lines: z.array(creditNoteLineSchema).min(1, "Add at least one line."),
});

export type CreditNoteCreateFormValues = z.infer<typeof creditNoteCreateSchema>;

export const payCycleSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required.").max(120, "Keep the name under 120 characters."),
    period_kind: z.enum(["fixed", "monthly"]),
    period_days: z.string().trim().optional().or(z.literal("")),
    anchor_date: z.string().min(1, "Pick the first day of a pay period."),
    payday_offset_days: z
      .string()
      .trim()
      .min(1, "Required.")
      .regex(/^\d{1,2}$/, "Enter whole days, 0 to 60.")
      .refine((value) => Number(value) <= 60, "Enter whole days, 0 to 60."),
    active: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.period_kind !== "fixed") return;
    const days = values.period_days ?? "";
    if (!/^\d{1,3}$/.test(days) || Number(days) < 1 || Number(days) > 365) {
      ctx.addIssue({
        code: "custom",
        path: ["period_days"],
        message: "Enter the period length in days, 1 to 365.",
      });
    }
  });

export type PayCycleFormValues = z.infer<typeof payCycleSchema>;
