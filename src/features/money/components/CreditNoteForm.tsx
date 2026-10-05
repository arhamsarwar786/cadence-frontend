"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useFieldArray, useForm, useWatch, type Path } from "react-hook-form";
import { fetchAllPages } from "@/api/client";
import { addCreditNoteLine, createCreditNote, updateCreditNote } from "@/features/money/actions";
import { invoiceKeys, listInvoices } from "@/features/money/api";
import {
  creditNoteCreateSchema,
  type CreditNoteCreateFormValues,
} from "@/features/money/schemas";
import type { CreditNote, Invoice } from "@/features/money/types";
import { fieldErrorsFrom, messageFrom } from "@/shared/lib/errors";
import { formatMoney } from "@/shared/lib/money";
import { Button, Field, Input, QueryError, Select, Textarea } from "@/shared/ui";

const NOTE_FIELDS = ["invoice_id", "reason", "issue_date"] as const;
/** The API's line keys → the form's line fields (amount is sent as a flat 1 × rate). */
const LINE_FIELD_FOR: Record<string, "description" | "amount" | "tax_exempt"> = {
  description: "description",
  rate: "amount",
  quantity: "amount",
  tax_exempt: "tax_exempt",
};

const EMPTY_LINE = { description: "", amount: "", tax_exempt: false };

function invoiceLabel(invoice: Invoice): string {
  const total = "total" in invoice ? ` · ${formatMoney(invoice.total)}` : "";
  const state = invoice.paid_at ? "paid" : "sent";
  return `${invoice.invoice_number ?? "Invoice"} · ${invoice.client_name}${total} · ${state}`;
}

export interface CreditNoteFormProps {
  /** Pre-selected invoice (the invoice page's "New credit note"). */
  invoiceId?: string;
  onCreated: (note: CreditNote) => void;
  onCancel: () => void;
}

/**
 * Drafts a credit note against one SENT, un-voided invoice (paid or not —
 * the API refuses any other) and adds its lines. The note and each line are
 * separate API writes, so a line that fails after the note exists keeps the
 * note: the next save re-uses it (and only adds the lines still missing).
 */
export function CreditNoteForm({ invoiceId, onCreated, onCancel }: CreditNoteFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  // Set once the note exists: a retry re-uses it and adds only the missing lines.
  const [createdNote, setCreatedNote] = useState<CreditNote | null>(null);
  // Re-render once lines land so added rows show as saved.
  const [addedLines, setAddedLines] = useState(0);

  const invoicesQuery = useQuery({
    queryKey: [...invoiceKeys.all, "creditable"],
    queryFn: () =>
      fetchAllPages((page) =>
        listInvoices({ page, pageSize: 200, status: "sent", voided: "false" }),
      ),
  });
  const invoices = invoicesQuery.data?.results ?? [];

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreditNoteCreateFormValues>({
    resolver: zodResolver(creditNoteCreateSchema),
    defaultValues: {
      invoice_id: invoiceId ?? "",
      reason: "",
      issue_date: "",
      lines: [{ ...EMPTY_LINE }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  const selectedId = useWatch({ control, name: "invoice_id" });
  const watchedLines = useWatch({ control, name: "lines" });
  const selected = invoices.find((invoice) => invoice.id === selectedId);
  const prefilledMissing =
    Boolean(invoiceId) && invoicesQuery.isSuccess && !invoices.some((i) => i.id === invoiceId);

  /** Pin a 400 onto the given field map; returns what is left for the banner. */
  function pinErrors(error: unknown, pathFor: (key: string) => Path<CreditNoteCreateFormValues> | null) {
    const leftover: string[] = [];
    let pinned = false;
    for (const [key, messages] of Object.entries(fieldErrorsFrom(error))) {
      const path = pathFor(key);
      if (path && messages[0]) {
        setError(path, { message: messages[0] });
        pinned = true;
      } else if (messages[0]) {
        leftover.push(`${key}: ${messages[0]}`);
      }
    }
    if (leftover.length) return leftover.join(" ");
    return pinned ? null : messageFrom(error);
  }

  async function submit(values: CreditNoteCreateFormValues) {
    if (isSubmitting) return;
    setFormError(null);
    let note = createdNote;
    try {
      if (!note) {
        note = await createCreditNote({
          invoice_id: values.invoice_id,
          reason: values.reason.trim(),
          issue_date: values.issue_date || undefined,
        });
        setCreatedNote(note);
      } else {
        await updateCreditNote(note.id, {
          reason: values.reason.trim(),
          ...(values.issue_date ? { issue_date: values.issue_date } : {}),
        });
      }
    } catch (error) {
      const banner = pinErrors(error, (key) =>
        (NOTE_FIELDS as readonly string[]).includes(key) ? (key as Path<CreditNoteCreateFormValues>) : null,
      );
      if (banner) setFormError(banner);
      return;
    }

    for (let index = addedLines; index < values.lines.length; index++) {
      const line = values.lines[index];
      try {
        await addCreditNoteLine(note.id, {
          description: line.description.trim(),
          unit: "flat",
          quantity: "1",
          rate: line.amount,
          tax_exempt: line.tax_exempt,
        });
        setAddedLines(index + 1);
      } catch (error) {
        const banner = pinErrors(error, (key) =>
          LINE_FIELD_FOR[key] ? (`lines.${index}.${LINE_FIELD_FOR[key]}` as Path<CreditNoteCreateFormValues>) : null,
        );
        setFormError(
          `Credit note ${note.credit_note_number} was saved as a draft, but line ${index + 1} was not added` +
            (banner ? `: ${banner}` : ".") +
            " Fix it and save again — the lines already added are kept.",
        );
        return;
      }
    }
    onCreated(note);
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="flex max-w-2xl flex-col gap-5">
      {invoicesQuery.isError ? (
        <QueryError error={invoicesQuery.error} onRetry={() => invoicesQuery.refetch()} />
      ) : null}

      {createdNote ? (
        <div className="flex flex-col gap-1.5 font-body text-sm">
          <span className="font-medium text-cadence-ink/80">Invoice</span>
          <p className="text-cadence-ink">{selected ? invoiceLabel(selected) : createdNote.invoice_number}</p>
        </div>
      ) : invoicesQuery.isLoading ? (
        <p className="font-body text-sm text-cadence-ink/60">Loading invoices…</p>
      ) : (
        <Field
          label="Invoice"
          htmlFor="cn-invoice"
          error={errors.invoice_id?.message}
          hint={
            prefilledMissing
              ? "That invoice can't be credited: only a sent (or paid) invoice that is not voided takes a credit note."
              : "Only sent or paid invoices that are not voided can be credited."
          }
        >
          <Select id="cn-invoice" aria-invalid={errors.invoice_id ? true : undefined} {...register("invoice_id")}>
            <option value="">{invoices.length ? "Pick an invoice" : "No invoices can be credited"}</option>
            {invoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoiceLabel(invoice)}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {selected ? (
        <p className="-mt-2 font-body text-sm text-cadence-ink/70">
          Billed {"total" in selected ? formatMoney(selected.total) : "—"} on {selected.issue_date}. Every
          issued credit note against it together can&apos;t exceed that total.
        </p>
      ) : null}

      <Field label="Reason" htmlFor="cn-reason" error={errors.reason?.message} hint="Printed on the credit note the client receives.">
        <Textarea
          id="cn-reason"
          rows={3}
          aria-invalid={errors.reason ? true : undefined}
          {...register("reason")}
        />
      </Field>

      <Field label="Issue date (optional)" htmlFor="cn-issue-date" error={errors.issue_date?.message} hint="Defaults to today.">
        <Input id="cn-issue-date" type="date" className="sm:max-w-56" {...register("issue_date")} />
      </Field>

      <section aria-labelledby="cn-lines-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="cn-lines-heading" className="font-subheading text-sm uppercase tracking-wide text-cadence-ink/60">
            Lines
          </h2>
          <Button type="button" variant="secondary" size="sm" onClick={() => append({ ...EMPTY_LINE })}>
            Add line
          </Button>
        </div>
        {fields.map((field, index) => {
          const lineErrors = errors.lines?.[index];
          const done = index < addedLines;
          return (
            <fieldset
              key={field.id}
              className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-surface p-4"
            >
              <legend className="px-1 font-body text-sm font-medium text-cadence-ink/80">
                Line {index + 1}
                {done ? " (added)" : ""}
              </legend>
              {done ? (
                <p className="flex justify-between gap-3 font-body text-sm text-cadence-ink">
                  <span className="min-w-0 break-words">{watchedLines?.[index]?.description}</span>
                  <span className="shrink-0">{formatMoney(watchedLines?.[index]?.amount)}</span>
                </p>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
                    <Field label="Description" htmlFor={`cn-line-${index}-description`} error={lineErrors?.description?.message}>
                      <Input
                        id={`cn-line-${index}-description`}
                        aria-invalid={lineErrors?.description ? true : undefined}
                        {...register(`lines.${index}.description`)}
                      />
                    </Field>
                    <Field label="Amount" htmlFor={`cn-line-${index}-amount`} error={lineErrors?.amount?.message}>
                      <Input
                        id={`cn-line-${index}-amount`}
                        inputMode="decimal"
                        placeholder="0.00"
                        aria-invalid={lineErrors?.amount ? true : undefined}
                        {...register(`lines.${index}.amount`)}
                      />
                    </Field>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 font-body text-sm text-cadence-ink/80">
                      <input type="checkbox" {...register(`lines.${index}.tax_exempt`)} />
                      No tax on this line
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove line ${index + 1}`}
                      disabled={fields.length - addedLines <= 1}
                      onClick={() => remove(index)}
                    >
                      Remove
                    </Button>
                  </div>
                  {lineErrors?.tax_exempt?.message ? (
                    <p className="text-xs text-cadence-red">{lineErrors.tax_exempt.message}</p>
                  ) : null}
                </>
              )}
            </fieldset>
          );
        })}
        {errors.lines?.root?.message || errors.lines?.message ? (
          <p className="text-xs text-cadence-red">{errors.lines?.root?.message ?? errors.lines?.message}</p>
        ) : null}
        <p className="font-body text-xs text-cadence-ink/60">
          Tax is added per line under the invoice&apos;s tax rules unless the line is marked no tax.
        </p>
      </section>

      {formError ? (
        <p role="alert" className="font-body text-sm text-cadence-red">
          {formError}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : createdNote ? "Save remaining lines" : "Create credit note"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
