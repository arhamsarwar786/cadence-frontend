import type { components } from "@openapi/schema";

export type Invoice = components["schemas"]["Invoice"];
/** The GET-by-id shape — embeds `lines` directly. */
export type InvoiceDetail = components["schemas"]["InvoiceDetail"];
export type InvoiceWrite = components["schemas"]["InvoiceWrite"];
export type InvoiceLine = components["schemas"]["InvoiceLine"];
export type InvoiceLineWrite = components["schemas"]["InvoiceLineWrite"];
export type AutoFill = components["schemas"]["AutoFill"];
export type InvoiceAutoFillResult = components["schemas"]["InvoiceAutoFillResult"];

export type PayrollRun = components["schemas"]["PayrollRun"];
/** The GET-by-id shape — embeds `payslips` directly (there's no separate
 * list-payslips-by-run door). */
export type PayrollRunDetail = components["schemas"]["PayrollRunDetail"];
export type PayrollRunCreate = components["schemas"]["PayrollRunCreate"];
export type Payslip = components["schemas"]["Payslip"];
export type PayslipDetail = components["schemas"]["PayslipDetail"];
export type PayslipLine = components["schemas"]["PayslipLine"];
export type PayslipEarningWrite = components["schemas"]["PayslipEarningWrite"];
export type PayslipDeduction = components["schemas"]["PayslipDeduction"];
export type PayslipDeductionWrite = components["schemas"]["PayslipDeductionWrite"];
export type EmployeeYTD = components["schemas"]["EmployeeYTD"];
