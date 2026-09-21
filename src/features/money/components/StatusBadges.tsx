import type { BadgeTone } from "@/shared/ui";
import { Badge } from "@/shared/ui";
import {
  INVOICE_STATUS_LABELS,
  PAYROLL_RUN_STATUS_LABELS,
  PAY_STATEMENT_STATUS_LABELS,
  type InvoiceStatus,
  type PayrollRunStatus,
  type PayStatementStatus,
} from "@/shared/lib/status-labels";

const INVOICE_TONE: Record<InvoiceStatus, BadgeTone> = {
  draft: "neutral",
  pending_approval: "warning",
  approved: "info",
  sent: "positive",
};

/** Resolve display status from enum + timestamps (void/paid are stamps, not statuses). */
export function resolveInvoiceDisplayStatus(invoice: {
  status: string;
  voided_at?: string | null;
  paid_at?: string | null;
}): string {
  if (invoice.voided_at) return "Voided";
  if (invoice.paid_at) return "Paid";
  return INVOICE_STATUS_LABELS[invoice.status as InvoiceStatus] ?? invoice.status;
}

export function InvoiceStatusBadge({
  status,
  voidedAt,
  paidAt,
}: {
  status: InvoiceStatus;
  voidedAt?: string | null;
  paidAt?: string | null;
}) {
  if (voidedAt) {
    return (
      <Badge tone="negative" tooltip="Invoice voided">
        Voided
      </Badge>
    );
  }
  if (paidAt) {
    return (
      <Badge tone="positive" tooltip="Invoice paid">
        Paid
      </Badge>
    );
  }
  return (
    <Badge tone={INVOICE_TONE[status]} tooltip={`Invoice: ${INVOICE_STATUS_LABELS[status]}`}>
      {INVOICE_STATUS_LABELS[status]}
    </Badge>
  );
}

const PAYROLL_RUN_TONE: Record<PayrollRunStatus, BadgeTone> = {
  draft: "neutral",
  approved: "positive",
};

export function resolvePayrollRunDisplayStatus(run: {
  status: string;
  paid_at?: string | null;
}): string {
  if (run.paid_at) return "Paid";
  return PAYROLL_RUN_STATUS_LABELS[run.status as PayrollRunStatus] ?? run.status;
}

export function PayrollRunStatusBadge({
  status,
  paidAt,
}: {
  status: PayrollRunStatus;
  paidAt?: string | null;
}) {
  if (paidAt) {
    return (
      <Badge tone="positive" tooltip="Payroll run paid">
        Paid
      </Badge>
    );
  }
  return (
    <Badge tone={PAYROLL_RUN_TONE[status]} tooltip={`Payroll run: ${PAYROLL_RUN_STATUS_LABELS[status]}`}>
      {PAYROLL_RUN_STATUS_LABELS[status]}
    </Badge>
  );
}

const PAY_STATEMENT_TONE: Record<PayStatementStatus, BadgeTone> = {
  draft: "neutral",
  issued: "info",
  paid: "positive",
};

export function PayStatementStatusBadge({ status }: { status: PayStatementStatus }) {
  return (
    <Badge
      tone={PAY_STATEMENT_TONE[status]}
      tooltip={`Pay statement: ${PAY_STATEMENT_STATUS_LABELS[status]}`}
    >
      {PAY_STATEMENT_STATUS_LABELS[status]}
    </Badge>
  );
}

/** @deprecated */
export const PayslipStatusBadge = PayStatementStatusBadge;
