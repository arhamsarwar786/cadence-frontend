"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { getClient, getClientBilling, listClients } from "@/features/clients/api";
import { listJobs } from "@/features/jobs/api";
import { autofillInvoice, createInvoice } from "@/features/money/actions";
import { getInvoice, invoiceKeys } from "@/features/money/api";
import { invoiceCreateSchema, type InvoiceCreateFormValues } from "@/features/money/schemas";
import { getOrgSettings, orgKeys } from "@/features/orgs/api";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import { formatMoney } from "@/shared/lib/money";
import { Button, Field, Input, Select, PageFrame, PageScrollRegion } from "@/shared/ui";

const FIELD_NAMES = Object.keys(invoiceCreateSchema.shape);

export default function NewInvoicePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const clientsQuery = useQuery({
    queryKey: ["clients-picker"],
    queryFn: () => listClients({ pageSize: 200 }),
  });
  const [step, setStep] = useState(1);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [autofillFrom, setAutofillFrom] = useState("");
  const [autofillTo, setAutofillTo] = useState("");
  const [autofillJobId, setAutofillJobId] = useState("");
  const [busy, setBusy] = useState(false);

  const orgQuery = useQuery({
    queryKey: orgKeys.settings,
    queryFn: getOrgSettings,
  });

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceCreateFormValues>({ resolver: zodResolver(invoiceCreateSchema) });

  const clientId = watch("client_id");
  const clientQuery = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => getClient(clientId),
    enabled: Boolean(clientId),
  });
  const billingQuery = useQuery({
    queryKey: ["client-billing", clientId],
    queryFn: () => getClientBilling(clientId),
    enabled: Boolean(clientId),
  });
  const invoiceQuery = useQuery({
    queryKey: invoiceKeys.detail(invoiceId ?? ""),
    queryFn: () => getInvoice(invoiceId!),
    enabled: Boolean(invoiceId),
  });
  const jobsQuery = useQuery({
    queryKey: ["jobs-picker", "client", clientId],
    queryFn: () => listJobs({ pageSize: 200, client: clientId }),
    enabled: Boolean(clientId),
  });

  const selectedClient = clientsQuery.data?.results.find((c) => c.id === clientId);
  const billing = billingQuery.data;
  const invoice = invoiceQuery.data;
  const org = orgQuery.data;
  const lines = invoice?.lines ?? [];
  const orgAddress = [
    org?.address_line_1,
    org?.address_line_2,
    [org?.city, org?.province, org?.postal_code].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join("\n");

  const preview = useMemo(() => {
    const subtotal = lines.reduce((sum, line) => sum + Number(line.amount ?? 0), 0);
    const tax = lines.reduce((sum, line) => {
      const taxes = "taxes" in line && Array.isArray(line.taxes) ? line.taxes : [];
      return sum + taxes.reduce((t: number, row: { amount?: string }) => t + Number(row.amount ?? 0), 0);
    }, 0);
    return { subtotal, tax, total: subtotal + tax };
  }, [lines]);

  async function createDraft(values: InvoiceCreateFormValues) {
    setFormError(null);
    try {
      const created = await createInvoice({
        client_id: values.client_id,
        issue_date: values.issue_date || undefined,
        due_date: values.due_date || undefined,
        po_number: values.po_number || "",
      });
      await queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
      setInvoiceId(created.id);
      setStep(2);
    } catch (error) {
      const banner = applyFieldErrors(setError, error, FIELD_NAMES);
      if (banner) setFormError(banner);
    }
  }

  async function runAutofill() {
    if (!invoiceId) return;
    setBusy(true);
    setFormError(null);
    try {
      await autofillInvoice(invoiceId, {
        date_from: autofillFrom || undefined,
        date_to: autofillTo || undefined,
        job_id: autofillJobId || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(invoiceId) });
      setStep(3);
    } catch (error) {
      setFormError(messageFrom(error));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (step >= 2 && !invoiceId) setStep(1);
  }, [step, invoiceId]);

  return (
    <PageFrame>
      <PageScrollRegion className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl text-cadence-ink">Invoice Creator</h1>
          <p className="font-body text-sm text-cadence-ink/55">Step {step} of 4</p>
        </div>
        {invoice ? (
          <div className="font-fine text-xs text-cadence-ink/50">
            {invoice.invoice_number ?? "Draft"} · Issued {invoice.issue_date} · Due {invoice.due_date}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-4 rounded-[1.5rem] bg-surface p-5">
          {step === 1 ? (
            <form onSubmit={handleSubmit(createDraft)} noValidate className="flex flex-col gap-4">
              <h2 className="font-subheading text-sm uppercase tracking-wide text-cadence-ink/50">
                Your client
              </h2>
              <Field label="Client" htmlFor="client_id" error={errors.client_id?.message}>
                <Select id="client_id" {...register("client_id")}>
                  <option value="">Select…</option>
                  {(clientsQuery.data?.results ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <p className="font-body text-xs text-cadence-ink/55">
                We&apos;ll fill billing details from the client record when you pick a company.
              </p>
              {billing ? (
                <dl className="grid gap-2 rounded-2xl border border-border p-3 text-sm">
                  <div>
                    <dt className="text-cadence-ink/60">Company</dt>
                    <dd>{billing.company_name || selectedClient?.name}</dd>
                  </div>
                  <div>
                    <dt className="text-cadence-ink/60">Billing email</dt>
                    <dd>{billing.billing_email || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-cadence-ink/60">Office address</dt>
                    <dd>
                      {[
                        clientQuery.data?.address_line_1,
                        clientQuery.data?.city,
                        clientQuery.data?.province,
                        clientQuery.data?.postal_code,
                      ]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-cadence-ink/60">Tax ID</dt>
                    <dd>{billing.tax_id || "—"}</dd>
                  </div>
                </dl>
              ) : null}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Issue date" htmlFor="issue_date" error={errors.issue_date?.message}>
                  <Input id="issue_date" type="date" {...register("issue_date")} />
                </Field>
                <Field label="Due date" htmlFor="due_date" error={errors.due_date?.message}>
                  <Input id="due_date" type="date" {...register("due_date")} />
                </Field>
              </div>
              <Field label="PO number" htmlFor="po_number" error={errors.po_number?.message}>
                <Input id="po_number" {...register("po_number")} />
              </Field>
              {formError ? <p className="text-sm text-cadence-red">{formError}</p> : null}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating…" : "Next (1/4)"}
              </Button>
            </form>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-4">
              <h2 className="font-subheading text-sm uppercase tracking-wide text-cadence-ink/50">
                Autofill lines
              </h2>
              <p className="text-sm text-cadence-ink/60">
                Pull unbilled worked shifts for this client into the draft.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="From" htmlFor="af-from">
                  <Input id="af-from" type="date" value={autofillFrom} onChange={(e) => setAutofillFrom(e.target.value)} />
                </Field>
                <Field label="To" htmlFor="af-to">
                  <Input id="af-to" type="date" value={autofillTo} onChange={(e) => setAutofillTo(e.target.value)} />
                </Field>
              </div>
              <Field label="Job (optional)" htmlFor="af-job">
                <Select id="af-job" value={autofillJobId} onChange={(e) => setAutofillJobId(e.target.value)}>
                  <option value="">All jobs for this client</option>
                  {(jobsQuery.data?.results ?? []).map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))}
                </Select>
              </Field>
              {formError ? <p className="text-sm text-cadence-red">{formError}</p> : null}
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="button" onClick={runAutofill} disabled={busy}>
                  {busy ? "Filling…" : "Autofill & continue"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setStep(3)}>
                  Skip
                </Button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="flex flex-col gap-4">
              <h2 className="font-subheading text-sm uppercase tracking-wide text-cadence-ink/50">
                Review lines
              </h2>
              <p className="text-sm text-cadence-ink/60">
                Tax rows come from the invoice lines (GST/HST/PST/QST). Open the full invoice to edit
                lines before submitting for approval.
              </p>
              {formError ? <p className="text-sm text-cadence-red">{formError}</p> : null}
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button type="button" onClick={() => setStep(4)}>
                  Next (3/4)
                </Button>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="flex flex-col gap-4">
              <h2 className="font-subheading text-sm uppercase tracking-wide text-cadence-ink/50">
                Ready
              </h2>
              <p className="text-sm text-cadence-ink/60">
                Draft is saved. Continue to the invoice to submit → approve → send. Cadence does not
                skip the approval step.
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setStep(3)}>
                  Back
                </Button>
                <Button type="button" onClick={() => invoiceId && router.push(`/invoices/${invoiceId}`)}>
                  Open invoice
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="rounded-[1.5rem] bg-card p-5 text-on-card shadow-card">
          <p className="font-subheading text-[10px] uppercase tracking-[0.18em] text-cadence-yellow">
            Live preview
          </p>
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="font-fine text-[10px] uppercase text-on-card-muted">From</p>
              <p>{org?.legal_name || org?.name || "—"}</p>
              {orgAddress ? (
                <p className="whitespace-pre-line text-on-card-muted">{orgAddress}</p>
              ) : null}
              {org?.email ? <p className="text-on-card-muted">{org.email}</p> : null}
              {org?.tax_id ? <p className="text-on-card-muted">Tax ID {org.tax_id}</p> : null}
            </div>
            <div>
              <p className="font-fine text-[10px] uppercase text-on-card-muted">To</p>
              <p>{selectedClient?.name ?? "—"}</p>
              <p className="text-on-card-muted">{billing?.billing_email || "—"}</p>
              <p className="text-on-card-muted">
                {[
                  clientQuery.data?.city,
                  clientQuery.data?.province,
                  clientQuery.data?.postal_code,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>
          </div>
          {org?.remit_to_details ? (
            <div className="mt-4 border-t border-white/10 pt-4 text-sm">
              <p className="font-fine text-[10px] uppercase text-on-card-muted">Payable IN</p>
              <p className="mt-1 whitespace-pre-line text-on-card-muted">{org.remit_to_details}</p>
            </div>
          ) : null}
          <table className="mt-6 w-full text-left text-sm">
            <thead className="font-fine text-[10px] uppercase text-on-card-muted">
              <tr>
                <th className="py-1">Description</th>
                <th className="py-1">Hrs</th>
                <th className="py-1">Rate</th>
                <th className="py-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-t border-white/10">
                  <td className="py-2">{line.description}</td>
                  <td className="py-2">{line.quantity ?? "—"}</td>
                  <td className="py-2">{"rate" in line ? formatMoney(line.rate) : "—"}</td>
                  <td className="py-2 text-right">
                    {"amount" in line ? formatMoney(line.amount) : "—"}
                  </td>
                </tr>
              ))}
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-on-card-muted">
                    Lines appear after autofill or edit on the invoice.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <div className="mt-4 space-y-1 border-t border-white/10 pt-4 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatMoney(String(preview.subtotal.toFixed(2)))}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax</span>
              <span>{formatMoney(String(preview.tax.toFixed(2)))}</span>
            </div>
            <div className="flex justify-between font-medium text-cadence-yellow">
              <span>Total</span>
              <span>{formatMoney(String(preview.total.toFixed(2)))}</span>
            </div>
          </div>
          <p className="mt-6 font-fine text-[10px] text-on-card-muted">Powered by Cadence</p>
        </aside>
      </div>
    </PageScrollRegion>
    </PageFrame>
  );
}
