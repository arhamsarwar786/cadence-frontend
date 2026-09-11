import { api, type Paginated } from "@/api/client";
import { resourceKeys } from "@/api/query-keys";
import type {
  EmployeeYTD,
  Invoice,
  InvoiceDetail,
  InvoiceLine,
  PayrollRun,
  PayrollRunDetail,
  PayslipDetail,
} from "@/features/money/types";

export const invoiceKeys = resourceKeys("invoices");
export const payrollRunKeys = resourceKeys("payroll-runs");

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

export function getPayslip(id: string): Promise<PayslipDetail> {
  return api.get<PayslipDetail>(`/api/v1/payroll/payslips/${id}/`);
}

export function getEmployeeYtd(employeeId: string): Promise<EmployeeYTD> {
  return api.get<EmployeeYTD>(`/api/v1/payroll/employees/${employeeId}/ytd/`);
}
