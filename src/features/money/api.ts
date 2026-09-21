import { api, type Paginated } from "@/api/client";
import { resourceKeys } from "@/api/query-keys";
import type {
  CreditNote,
  CreditNoteDetail,
  Dashboard,
  EmployeeYTD,
  Invoice,
  InvoiceDetail,
  InvoiceLine,
  PayCycle,
  PayrollRun,
  PayrollRunDetail,
  PayStatement,
  PayStatementDetail,
  Placement,
} from "@/features/money/types";

export const invoiceKeys = resourceKeys("invoices");
export const payrollRunKeys = resourceKeys("payroll-runs");
export const payCycleKeys = resourceKeys("pay-cycles");
export const payStatementKeys = resourceKeys("pay-statements");
export const creditNoteKeys = resourceKeys("credit-notes");
export const placementKeys = resourceKeys("perm-placements");
export const reportKeys = resourceKeys("reports");

function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export interface ListInvoicesParams {
  page?: number;
  pageSize?: number;
  status?: string;
  client?: string;
}

export function listInvoices(params: ListInvoicesParams = {}): Promise<Paginated<Invoice>> {
  return api.get<Paginated<Invoice>>(
    `/api/v1/invoices/${toQuery({ page: params.page, page_size: params.pageSize, status: params.status, client: params.client })}`,
  );
}

export function getInvoice(id: string): Promise<InvoiceDetail> {
  return api.get<InvoiceDetail>(`/api/v1/invoices/${id}/`);
}

export function listInvoiceLines(invoiceId: string): Promise<InvoiceLine[]> {
  return api.get<InvoiceLine[]>(`/api/v1/invoices/${invoiceId}/lines/`);
}

export interface ListPayrollRunsParams {
  page?: number;
  pageSize?: number;
}

export function listPayrollRuns(
  params: ListPayrollRunsParams = {},
): Promise<Paginated<PayrollRun>> {
  return api.get<Paginated<PayrollRun>>(
    `/api/v1/payroll/runs/${toQuery({ page: params.page, page_size: params.pageSize })}`,
  );
}

export function getPayrollRun(id: string): Promise<PayrollRunDetail> {
  return api.get<PayrollRunDetail>(`/api/v1/payroll/runs/${id}/`);
}

export function getPayStatement(id: string): Promise<PayStatementDetail> {
  return api.get<PayStatementDetail>(`/api/v1/payroll/pay-statements/${id}/`);
}

/** @deprecated Use getPayStatement. */
export const getPayslip = getPayStatement;

export function getEmployeeYtd(employeeId: string): Promise<EmployeeYTD> {
  return api.get<EmployeeYTD>(`/api/v1/payroll/employees/${employeeId}/ytd/`);
}

export function listPayCycles(): Promise<Paginated<PayCycle> | PayCycle[]> {
  return api.get(`/api/v1/payroll/cycles/`);
}

export function exportPayrollRunUrl(id: string): string {
  return `/api/v1/payroll/runs/${id}/export/`;
}

export function getReportsDashboard(): Promise<Dashboard> {
  return api.get<Dashboard>("/api/v1/reports/dashboard/");
}

export interface ListCreditNotesParams {
  page?: number;
  pageSize?: number;
  status?: string;
}

export function listCreditNotes(
  params: ListCreditNotesParams = {},
): Promise<Paginated<CreditNote>> {
  return api.get<Paginated<CreditNote>>(
    `/api/v1/credit-notes/${toQuery({ page: params.page, page_size: params.pageSize, status: params.status })}`,
  );
}

export function getCreditNote(id: string): Promise<CreditNoteDetail> {
  return api.get<CreditNoteDetail>(`/api/v1/credit-notes/${id}/`);
}

export interface ListPlacementsParams {
  page?: number;
  pageSize?: number;
}

export function listPlacements(
  params: ListPlacementsParams = {},
): Promise<Paginated<Placement>> {
  return api.get<Paginated<Placement>>(
    `/api/v1/perm-placements/${toQuery({ page: params.page, page_size: params.pageSize })}`,
  );
}

export function getPlacement(id: string): Promise<Placement> {
  return api.get<Placement>(`/api/v1/perm-placements/${id}/`);
}

export type { PayStatement };
