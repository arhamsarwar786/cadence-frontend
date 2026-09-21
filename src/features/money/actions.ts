import { api } from "@/api/client";
import type {
  AutoFill,
  CreditNote,
  CreditNoteLine,
  CreditNoteLineWrite,
  CreditNoteWrite,
  Invoice,
  InvoiceAutoFillResult,
  InvoiceLine,
  InvoiceLineWrite,
  InvoiceWrite,
  PayCycle,
  PayCycleCreate,
  PayrollRun,
  PayrollRunCreate,
  PayStatementDeduction,
  PayStatementDeductionWrite,
  PayStatementEarningWrite,
  PayStatementLine,
  Placement,
  PlacementWrite,
} from "@/features/money/types";

// --- Invoices ------------------------------------------------------------

export function createInvoice(body: InvoiceWrite): Promise<Invoice> {
  return api.post<Invoice>("/api/v1/invoices/", body);
}

export function updateInvoice(id: string, body: Partial<InvoiceWrite>): Promise<Invoice> {
  return api.patch<Invoice>(`/api/v1/invoices/${id}/`, body);
}

export function autofillInvoice(id: string, body: AutoFill): Promise<InvoiceAutoFillResult> {
  return api.post<InvoiceAutoFillResult>(`/api/v1/invoices/${id}/autofill/`, body);
}

export function addInvoiceLine(invoiceId: string, body: InvoiceLineWrite): Promise<InvoiceLine> {
  return api.post<InvoiceLine>(`/api/v1/invoices/${invoiceId}/lines/`, body);
}

export function updateInvoiceLine(
  invoiceId: string,
  lineId: string,
  body: Partial<InvoiceLineWrite>,
): Promise<InvoiceLine> {
  return api.patch<InvoiceLine>(`/api/v1/invoices/${invoiceId}/lines/${lineId}/`, body);
}

export function deleteInvoiceLine(invoiceId: string, lineId: string): Promise<void> {
  return api.delete<void>(`/api/v1/invoices/${invoiceId}/lines/${lineId}/`);
}

export function submitInvoice(id: string): Promise<Invoice> {
  return api.post<Invoice>(`/api/v1/invoices/${id}/submit/`);
}

export function approveInvoice(id: string): Promise<Invoice> {
  return api.post<Invoice>(`/api/v1/invoices/${id}/approve/`);
}

export function unapproveInvoice(id: string): Promise<Invoice> {
  return api.post<Invoice>(`/api/v1/invoices/${id}/unapprove/`);
}

export function sendInvoice(id: string): Promise<Invoice> {
  return api.post<Invoice>(`/api/v1/invoices/${id}/send/`);
}

export function markInvoicePaid(id: string): Promise<Invoice> {
  return api.post<Invoice>(`/api/v1/invoices/${id}/mark-paid/`);
}

export function voidInvoice(id: string): Promise<Invoice> {
  return api.post<Invoice>(`/api/v1/invoices/${id}/void/`);
}

export function returnInvoiceToDraft(id: string): Promise<Invoice> {
  return api.post<Invoice>(`/api/v1/invoices/${id}/return-to-draft/`);
}

// --- Payroll ------------------------------------------------------------

export function createPayrollRun(body: PayrollRunCreate): Promise<PayrollRun> {
  return api.post<PayrollRun>("/api/v1/payroll/runs/", body);
}

export function deletePayrollRun(id: string): Promise<void> {
  return api.delete<void>(`/api/v1/payroll/runs/${id}/`);
}

export function approvePayrollRun(id: string): Promise<PayrollRun> {
  return api.post<PayrollRun>(`/api/v1/payroll/runs/${id}/approve/`);
}

export function releasePayrollRun(id: string): Promise<PayrollRun> {
  return api.post<PayrollRun>(`/api/v1/payroll/runs/${id}/release/`);
}

export function generatePayrollRun(): Promise<PayrollRun> {
  return api.post<PayrollRun>("/api/v1/payroll/runs/generate/");
}

export function createPayCycle(body: PayCycleCreate): Promise<PayCycle> {
  return api.post<PayCycle>("/api/v1/payroll/cycles/", body);
}

export function updatePayCycle(id: string, body: Partial<PayCycleCreate>): Promise<PayCycle> {
  return api.patch<PayCycle>(`/api/v1/payroll/cycles/${id}/`, body);
}

export function deletePayCycle(id: string): Promise<void> {
  return api.delete<void>(`/api/v1/payroll/cycles/${id}/`);
}

export function addPayStatementLine(
  statementId: string,
  body: PayStatementEarningWrite,
): Promise<PayStatementLine> {
  return api.post<PayStatementLine>(`/api/v1/payroll/pay-statements/${statementId}/lines/`, body);
}

export function updatePayStatementLine(
  statementId: string,
  lineId: string,
  body: Partial<PayStatementEarningWrite>,
): Promise<PayStatementLine> {
  return api.patch<PayStatementLine>(
    `/api/v1/payroll/pay-statements/${statementId}/lines/${lineId}/`,
    body,
  );
}

export function deletePayStatementLine(statementId: string, lineId: string): Promise<void> {
  return api.delete<void>(`/api/v1/payroll/pay-statements/${statementId}/lines/${lineId}/`);
}

export function addPayStatementDeduction(
  statementId: string,
  body: PayStatementDeductionWrite,
): Promise<PayStatementDeduction> {
  return api.post<PayStatementDeduction>(
    `/api/v1/payroll/pay-statements/${statementId}/deductions/`,
    body,
  );
}

export function updatePayStatementDeduction(
  statementId: string,
  deductionId: string,
  body: Partial<PayStatementDeductionWrite>,
): Promise<PayStatementDeduction> {
  return api.patch<PayStatementDeduction>(
    `/api/v1/payroll/pay-statements/${statementId}/deductions/${deductionId}/`,
    body,
  );
}

export function deletePayStatementDeduction(
  statementId: string,
  deductionId: string,
): Promise<void> {
  return api.delete<void>(
    `/api/v1/payroll/pay-statements/${statementId}/deductions/${deductionId}/`,
  );
}

/** @deprecated */
export const addPayslipLine = addPayStatementLine;
/** @deprecated */
export const updatePayslipLine = updatePayStatementLine;
/** @deprecated */
export const deletePayslipLine = deletePayStatementLine;
/** @deprecated */
export const addPayslipDeduction = addPayStatementDeduction;
/** @deprecated */
export const updatePayslipDeduction = updatePayStatementDeduction;
/** @deprecated */
export const deletePayslipDeduction = deletePayStatementDeduction;

// --- Credit notes -------------------------------------------------------

export function createCreditNote(body: CreditNoteWrite): Promise<CreditNote> {
  return api.post<CreditNote>("/api/v1/credit-notes/", body);
}

export function approveCreditNote(id: string): Promise<CreditNote> {
  return api.post<CreditNote>(`/api/v1/credit-notes/${id}/approve/`);
}

export function unapproveCreditNote(id: string): Promise<CreditNote> {
  return api.post<CreditNote>(`/api/v1/credit-notes/${id}/unapprove/`);
}

export function issueCreditNote(id: string): Promise<CreditNote> {
  return api.post<CreditNote>(`/api/v1/credit-notes/${id}/issue/`);
}

export function sendCreditNote(id: string): Promise<CreditNote> {
  return api.post<CreditNote>(`/api/v1/credit-notes/${id}/send/`);
}

export function voidCreditNote(id: string): Promise<CreditNote> {
  return api.post<CreditNote>(`/api/v1/credit-notes/${id}/void/`);
}

export function addCreditNoteLine(
  noteId: string,
  body: CreditNoteLineWrite,
): Promise<CreditNoteLine> {
  return api.post<CreditNoteLine>(`/api/v1/credit-notes/${noteId}/lines/`, body);
}

export function deleteCreditNoteLine(noteId: string, lineId: string): Promise<void> {
  return api.delete<void>(`/api/v1/credit-notes/${noteId}/lines/${lineId}/`);
}

// --- Perm placements ----------------------------------------------------

export function createPlacement(body: PlacementWrite): Promise<Placement> {
  return api.post<Placement>("/api/v1/perm-placements/", body);
}

export function updatePlacement(id: string, body: Partial<PlacementWrite>): Promise<Placement> {
  return api.patch<Placement>(`/api/v1/perm-placements/${id}/`, body);
}

export function confirmPlacement(id: string): Promise<Placement> {
  return api.post<Placement>(`/api/v1/perm-placements/${id}/confirm/`);
}

export function voidPlacement(id: string): Promise<Placement> {
  return api.post<Placement>(`/api/v1/perm-placements/${id}/void/`);
}
