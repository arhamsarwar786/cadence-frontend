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
