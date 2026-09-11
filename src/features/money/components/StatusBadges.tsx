import type { BadgeTone } from "@/shared/ui";
import { Badge } from "@/shared/ui";
import {
  INVOICE_STATUS_LABELS,
  PAYROLL_RUN_STATUS_LABELS,
  PAYSLIP_STATUS_LABELS,
  type InvoiceStatus,
  type PayrollRunStatus,
  type PayslipStatus,
} from "@/shared/lib/status-labels";

const INVOICE_TONE: Record<InvoiceStatus, BadgeTone> = {
  draft: "neutral",
  pending_approval: "warning",
  approved: "info",
  sent: "positive",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge tone={INVOICE_TONE[status]}>{INVOICE_STATUS_LABELS[status]}</Badge>;
}

const PAYROLL_RUN_TONE: Record<PayrollRunStatus, BadgeTone> = {
  draft: "neutral",
  approved: "positive",
};

export function PayrollRunStatusBadge({ status }: { status: PayrollRunStatus }) {
  return <Badge tone={PAYROLL_RUN_TONE[status]}>{PAYROLL_RUN_STATUS_LABELS[status]}</Badge>;
}

const PAYSLIP_TONE: Record<PayslipStatus, BadgeTone> = {
  draft: "neutral",
  issued: "info",
  paid: "positive",
};

export function PayslipStatusBadge({ status }: { status: PayslipStatus }) {
  return <Badge tone={PAYSLIP_TONE[status]}>{PAYSLIP_STATUS_LABELS[status]}</Badge>;
}
