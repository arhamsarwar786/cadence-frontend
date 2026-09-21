"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notFound, useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useSession } from "@/auth/session-context";
import {
  approveInvoice,
  autofillInvoice,
  markInvoicePaid,
  returnInvoiceToDraft,
  sendInvoice,
  submitInvoice,
  unapproveInvoice,
  voidInvoice,
} from "@/features/money/actions";
import { getInvoice, invoiceKeys } from "@/features/money/api";
import { InvoiceLinesPanel } from "@/features/money/components/InvoiceLinesPanel";
import { InvoiceStatusBadge } from "@/features/money/components/StatusBadges";
import { autofillSchema, type AutofillFormValues } from "@/features/money/schemas";
import { PERM } from "@/permissions/keys";
import { isNotFound, messageFrom } from "@/shared/lib/errors";
import { formatDate } from "@/shared/lib/datetime";
import { formatMoney } from "@/shared/lib/money";
import type { InvoiceStatus } from "@/shared/lib/status-labels";
import { Button, Dialog, Field, Input, PermGate, useConfirm } from "@/shared/ui";

export default function InvoiceDetailPage() {
  const { id: invoiceId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const timeZone = session?.organization.timezone;
  const [actionError, setActionError] = useState<string | null>(null);
  const [autofillOpen, setAutofillOpen] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const query = useQuery({
    queryKey: invoiceKeys.detail(invoiceId),
    queryFn: () => getInvoice(invoiceId),
    retry: false,
  });

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<AutofillFormValues>({ resolver: zodResolver(autofillSchema) });

  if (query.isError && isNotFound(query.error)) notFound();

  function refetch() {
    return queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(invoiceId) });
  }

  async function runAction(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
      await refetch();
    } catch (error) {
      setActionError(messageFrom(error));
    }
  }

  async function submitAutofill(values: AutofillFormValues) {
    setActionError(null);
    try {
      await autofillInvoice(invoiceId, {
        date_from: values.date_from || undefined,
        date_to: values.date_to || undefined,
        job_id: values.job_id || undefined,
      });
      await refetch();
      setAutofillOpen(false);
    } catch (error) {
      setActionError(messageFrom(error));
    }
  }

  if (query.isLoading) return <p className="font-body text-sm text-cadence-ink/60">Loading…</p>;
  if (query.isError) {
    return <p className="font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>;
  }
  const invoice = query.data;
  if (!invoice) return null;
  const status = invoice.status as InvoiceStatus;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-3xl text-cadence-ink">
            {invoice.invoice_number ?? "Draft invoice"}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <InvoiceStatusBadge
              status={status}
              voidedAt={invoice.voided_at}
              paidAt={invoice.paid_at}
            />
            <span className="font-body text-sm text-cadence-ink/60">{invoice.client_name}</span>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {status === "draft" ? (
            <PermGate anyOf={PERM.CLIENTS_INVOICE_EDIT}>
              <>
                <Button variant="secondary" onClick={() => setAutofillOpen(true)}>
                  Autofill
                </Button>
                <Button onClick={() => runAction(() => submitInvoice(invoiceId))}>
                  Submit for approval
                </Button>
              </>
            </PermGate>
          ) : null}
          {status === "pending_approval" ? (
            <PermGate anyOf={PERM.CLIENTS_INVOICE_APPROVE}>
              <>
                <Button onClick={() => runAction(() => approveInvoice(invoiceId))}>Approve</Button>
                <Button variant="secondary" onClick={() => runAction(() => returnInvoiceToDraft(invoiceId))}>
                  Return to draft
                </Button>
              </>
            </PermGate>
          ) : null}
          {status === "approved" ? (
            <>
              <PermGate anyOf={PERM.INVOICES_SEND}>
                <Button onClick={() => runAction(() => sendInvoice(invoiceId))}>Send</Button>
              </PermGate>
              <PermGate anyOf={PERM.CLIENTS_INVOICE_APPROVE}>
                <Button variant="secondary" onClick={() => runAction(() => unapproveInvoice(invoiceId))}>
                  Unapprove
                </Button>
              </PermGate>
            </>
          ) : null}
          {status === "sent" && !invoice.paid_at ? (
            <>
              <PermGate anyOf={PERM.INVOICES_MARK_PAID}>
                <Button onClick={() => runAction(() => markInvoicePaid(invoiceId))}>
                  Mark paid
                </Button>
              </PermGate>
              <PermGate anyOf={[PERM.CLIENTS_INVOICE_EDIT, PERM.INVOICES_SEND]}>
                <Button
                  variant="danger"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Void this invoice?",
                      body: "Voiding a sent invoice is a correction. The client-facing number stays in the register as voided. This cannot be undone from this screen.",
                      confirmLabel: "Void invoice",
                      danger: true,
                    });
                    if (ok) await runAction(() => voidInvoice(invoiceId));
                  }}
                >
                  Void
                </Button>
              </PermGate>
            </>
          ) : null}
          <a
            href={`/api/v1/invoices/${invoiceId}/pdf/`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center rounded-md border border-border px-4 font-body text-sm text-cadence-ink hover:bg-surface-muted"
          >
            View PDF
          </a>
        </div>
      </div>

      {actionError ? <p className="font-body text-sm text-cadence-red">{actionError}</p> : null}

      <dl className="grid max-w-xl grid-cols-2 gap-x-8 gap-y-3 font-body text-sm">
        <div>
          <dt className="text-cadence-ink/60">Issue date</dt>
          <dd className="text-cadence-ink">{invoice.issue_date}</dd>
        </div>
        <div>
          <dt className="text-cadence-ink/60">Due date</dt>
          <dd className="text-cadence-ink">{invoice.due_date}</dd>
        </div>
        <div>
          <dt className="text-cadence-ink/60">Subtotal</dt>
          <dd className="text-cadence-ink">
            {"subtotal" in invoice ? formatMoney(invoice.subtotal) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-cadence-ink/60">Tax</dt>
          <dd className="text-cadence-ink">
            {"tax_amount" in invoice ? formatMoney(invoice.tax_amount) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-cadence-ink/60">Total</dt>
          <dd className="font-medium text-cadence-ink">
            {"total" in invoice ? formatMoney(invoice.total) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-cadence-ink/60">Paid</dt>
          <dd className="text-cadence-ink">
            {invoice.paid_at && timeZone ? formatDate(invoice.paid_at, timeZone) : invoice.paid_at ? "—" : "Not paid"}
          </dd>
        </div>
      </dl>

      <InvoiceLinesPanel invoiceId={invoiceId} lines={invoice.lines} editable={status === "draft"} />

      <Dialog open={autofillOpen} onClose={() => setAutofillOpen(false)} title="Autofill from unbilled shifts">
        <form onSubmit={handleSubmit(submitAutofill)} noValidate className="flex flex-col gap-4">
          <p className="font-body text-sm text-on-card-muted">
            With no filters, this fills the draft from every unbilled worked shift of this
            client.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="From" htmlFor="autofill-from">
              <Input id="autofill-from" type="date" {...register("date_from")} />
            </Field>
            <Field label="To" htmlFor="autofill-to">
              <Input id="autofill-to" type="date" {...register("date_to")} />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Filling…" : "Autofill"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setAutofillOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
