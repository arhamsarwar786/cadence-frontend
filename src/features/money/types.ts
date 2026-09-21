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
/** The GET-by-id shape — embeds `pay_statements` directly. */
export type PayrollRunDetail = components["schemas"]["PayrollRunDetail"];
export type PayrollRunCreate = components["schemas"]["PayrollRunCreate"];
export type PayCycle = components["schemas"]["PayCycle"];
export type PayCycleCreate = components["schemas"]["PayCycleCreate"];

export type PayStatement = components["schemas"]["PayStatement"];
export type PayStatementDetail = components["schemas"]["PayStatementDetail"];
export type PayStatementLine = components["schemas"]["PayStatementLine"];
export type PayStatementEarningWrite = components["schemas"]["PayStatementEarningWrite"];
export type PayStatementDeduction = components["schemas"]["PayStatementDeduction"];
export type PayStatementDeductionWrite = components["schemas"]["PayStatementDeductionWrite"];
export type EmployeeYTD = components["schemas"]["EmployeeYTD"];

/** @deprecated Use PayStatement — catalog renamed. */
export type Payslip = PayStatement;
/** @deprecated Use PayStatementDetail. */
export type PayslipDetail = PayStatementDetail;
/** @deprecated Use PayStatementLine. */
export type PayslipLine = PayStatementLine;
/** @deprecated Use PayStatementEarningWrite. */
export type PayslipEarningWrite = PayStatementEarningWrite;
/** @deprecated Use PayStatementDeduction. */
export type PayslipDeduction = PayStatementDeduction;
/** @deprecated Use PayStatementDeductionWrite. */
export type PayslipDeductionWrite = PayStatementDeductionWrite;

export type CreditNote = components["schemas"]["CreditNote"];
export type CreditNoteDetail = components["schemas"]["CreditNoteDetail"];
export type CreditNoteWrite = components["schemas"]["CreditNoteWrite"];
export type CreditNoteLine = components["schemas"]["CreditNoteLine"];
export type CreditNoteLineWrite = components["schemas"]["CreditNoteLineWrite"];

export type Placement = components["schemas"]["Placement"];
export type PlacementWrite = components["schemas"]["PlacementWrite"];

export type Dashboard = components["schemas"]["Dashboard"];
