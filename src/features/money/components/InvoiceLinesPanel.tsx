"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { addInvoiceLine, deleteInvoiceLine } from "@/features/money/actions";
import { invoiceKeys } from "@/features/money/api";
import { invoiceLineSchema, type InvoiceLineFormValues } from "@/features/money/schemas";
import type { InvoiceLine } from "@/features/money/types";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import { formatMoney } from "@/shared/lib/money";
import { Button, Dialog, Field, Input, Select, useConfirm } from "@/shared/ui";

const FIELD_NAMES = Object.keys(invoiceLineSchema.shape);

export function InvoiceLinesPanel({
  invoiceId,
  lines,
  editable,
}: {
  invoiceId: string;
  lines: InvoiceLine[];
  editable: boolean;
}) {
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceLineFormValues>({ resolver: zodResolver(invoiceLineSchema) });

  function refetch() {
    return queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(invoiceId) });
  }

  async function submit(values: InvoiceLineFormValues) {
    setFormError(null);
    try {
      await addInvoiceLine(invoiceId, { ...values, tax_exempt: values.tax_exempt ?? false });
      await refetch();
      reset();
      setOpen(false);
    } catch (error) {
      const matched = applyFieldErrors(setError, error, FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
    }
  }

  async function handleDelete(lineId: string) {
    const ok = await confirm({
      title: "Remove this line?",
      body: "The line will be deleted from this invoice.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    await deleteInvoiceLine(invoiceId, lineId);
    await refetch();
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-subheading text-xl text-cadence-ink">Lines</h2>
        {editable ? (
          <Button size="sm" onClick={() => setOpen(true)}>
            Add line
          </Button>
        ) : null}
      </div>

      {lines.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {lines.map((line) => (
            <li key={line.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-body text-sm text-cadence-ink">{line.description}</p>
                <p className="font-body text-xs text-cadence-ink/60">
                  {line.quantity} {line.unit} @ {formatMoney(line.rate)} ={" "}
                  {formatMoney(line.amount)}
                </p>
              </div>
              {editable ? (
                <Button size="sm" variant="ghost" onClick={() => handleDelete(line.id)}>
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-sm text-cadence-ink/60">No lines yet.</p>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Add line">
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <Field label="Description" htmlFor="line-desc" error={errors.description?.message}>
            <Input id="line-desc" {...register("description")} />
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Unit" htmlFor="line-unit" error={errors.unit?.message}>
              <Select id="line-unit" {...register("unit")}>
                <option value="hour">Hour</option>
                <option value="day">Day</option>
                <option value="flat">Flat</option>
              </Select>
            </Field>
            <Field label="Quantity" htmlFor="line-qty" error={errors.quantity?.message}>
              <Input id="line-qty" {...register("quantity")} />
            </Field>
            <Field label="Rate" htmlFor="line-rate" error={errors.rate?.message}>
              <Input id="line-rate" {...register("rate")} />
            </Field>
          </div>
          <label className="flex items-center gap-2 font-body text-sm text-cadence-ink">
            <input type="checkbox" {...register("tax_exempt")} />
            Tax exempt
          </label>
          {formError ? <p className="font-body text-sm text-cadence-red">{formError}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>
      {confirmDialog}
    </section>
  );
}
