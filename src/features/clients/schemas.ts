import { z } from "zod";

export const PROVINCES = [
  "AB",
  "BC",
  "MB",
  "NB",
  "NL",
  "NS",
  "NT",
  "NU",
  "ON",
  "PE",
  "QC",
  "SK",
  "YT",
] as const;

export const PROVINCE_LABELS: Record<(typeof PROVINCES)[number], string> = {
  AB: "Alberta",
  BC: "British Columbia",
  MB: "Manitoba",
  NB: "New Brunswick",
  NL: "Newfoundland and Labrador",
  NS: "Nova Scotia",
  NT: "Northwest Territories",
  NU: "Nunavut",
  ON: "Ontario",
  PE: "Prince Edward Island",
  QC: "Quebec",
  SK: "Saskatchewan",
  YT: "Yukon",
};

/** Client create/edit — a decimal STRING for markup_pct, matching the API
 * exactly (never a number the client could round or float-drift). */
export const clientSchema = z.object({
  name: z.string().min(1, "Name is required.").max(255),
  status: z.enum(["prospect", "active", "inactive"]),
  address_line_1: z.string().min(1, "Address is required.").max(255),
  address_line_2: z.string().max(255).optional().or(z.literal("")),
  city: z.string().min(1, "City is required.").max(128),
  province: z.enum(PROVINCES),
  postal_code: z
    .string()
    .min(1, "Postal code is required.")
    .max(7)
    .regex(/^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/, "Enter a valid Canadian postal code."),
  // Required on CREATE (the backend's ClientWrite), optional on EDIT (a
  // PATCH is auto-partial, and a scoped user without clients.markup.view
  // never receives this field to begin with — clientCreateSchema below
  // adds the requirement back for /clients/new specifically).
  markup_pct: z
    .string()
    .regex(/^-?\d{0,3}(?:\.\d{0,2})?$/, "Enter a number like 35 or 35.00.")
    .optional()
    .or(z.literal("")),
  // .optional() alone allows `undefined`, not the "" a blank <select>
  // option actually submits — needs "" in the enum itself.
  billing_cycle: z.enum(["weekly", "biweekly", "monthly", ""]).optional(),
});

export const clientCreateSchema = clientSchema.extend({
  markup_pct: z
    .string()
    .min(1, "Markup % is required.")
    .regex(/^-?\d{0,3}(?:\.\d{0,2})?$/, "Enter a number like 35 or 35.00."),
});

export type ClientFormValues = z.infer<typeof clientSchema>;

export const clientContactSchema = z.object({
  name: z.string().min(1, "Name is required.").max(255),
  title: z.string().max(128).optional().or(z.literal("")),
  email: z.string().email("Enter a valid email.").max(254).optional().or(z.literal("")),
  phone: z.string().max(24).optional().or(z.literal("")),
  is_primary: z.boolean().optional(),
  receives_job_notifications: z.boolean().optional(),
});

export type ClientContactFormValues = z.infer<typeof clientContactSchema>;

export const clientBillingSchema = z.object({
  company_name: z.string().min(1, "Company name is required.").max(255),
  billing_email: z.string().email("Enter a valid email.").max(254).optional().or(z.literal("")),
  tax_id: z.string().max(32).optional().or(z.literal("")),
  payment_terms: z.enum(["due_on_receipt", "net_15", "net_30", "net_60", ""]).optional(),
  po_required: z.boolean().optional(),
});

export type ClientBillingFormValues = z.infer<typeof clientBillingSchema>;
