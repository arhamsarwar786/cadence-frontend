import { api } from "@/api/client";
import type {
  AutoFill,
  Invoice,
  InvoiceAutoFillResult,
  InvoiceLine,
  InvoiceLineWrite,
  InvoiceWrite,
  PayrollRun,
  PayrollRunCreate,
  PayslipDeduction,
  PayslipDeductionWrite,
  PayslipEarningWrite,
  PayslipLine,
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

/** draft -> pending_approval -> approved -> sent (ARCHITECTURE.md §5.1).
 * Never a status PATCH — each is its own named door. */
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

/** Only if not paid (ARCHITECTURE.md §5.1) — the server re-checks
 * regardless of what the button shows. */
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

/** draft -> approved, then paid_at is stamped on release — no un-approve,
 * no void (ARCHITECTURE.md §5.1). */
export function approvePayrollRun(id: string): Promise<PayrollRun> {
  return api.post<PayrollRun>(`/api/v1/payroll/runs/${id}/approve/`);
}

export function releasePayrollRun(id: string): Promise<PayrollRun> {
  return api.post<PayrollRun>(`/api/v1/payroll/runs/${id}/release/`);
}

export function addPayslipLine(payslipId: string, body: PayslipEarningWrite): Promise<PayslipLine> {
  return api.post<PayslipLine>(`/api/v1/payroll/payslips/${payslipId}/lines/`, body);
}

export function updatePayslipLine(
  payslipId: string,
  lineId: string,
  body: Partial<PayslipEarningWrite>,
): Promise<PayslipLine> {
  return api.patch<PayslipLine>(`/api/v1/payroll/payslips/${payslipId}/lines/${lineId}/`, body);
}

export function deletePayslipLine(payslipId: string, lineId: string): Promise<void> {
  return api.delete<void>(`/api/v1/payroll/payslips/${payslipId}/lines/${lineId}/`);
}

export function addPayslipDeduction(
  payslipId: string,
  body: PayslipDeductionWrite,
): Promise<PayslipDeduction> {
  return api.post<PayslipDeduction>(`/api/v1/payroll/payslips/${payslipId}/deductions/`, body);
}

export function updatePayslipDeduction(
  payslipId: string,
  deductionId: string,
  body: Partial<PayslipDeductionWrite>,
): Promise<PayslipDeduction> {
  return api.patch<PayslipDeduction>(
    `/api/v1/payroll/payslips/${payslipId}/deductions/${deductionId}/`,
    body,
  );
}

export function deletePayslipDeduction(payslipId: string, deductionId: string): Promise<void> {
  return api.delete<void>(`/api/v1/payroll/payslips/${payslipId}/deductions/${deductionId}/`);
}
