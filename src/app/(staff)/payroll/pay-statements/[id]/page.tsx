"use client";

import { Loading } from "@/shared/ui/Loading";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notFound, useParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  addPayStatementDeduction,
  addPayStatementLine,
  deletePayStatementDeduction,
  deletePayStatementLine,
  generatePayStatementPdf,
} from "@/features/money/actions";
import { getEmployeeYtd, getPayStatement, payStatementKeys } from "@/features/money/api";
import { PayStatementStatusBadge } from "@/features/money/components/StatusBadges";
import { payslipDeductionSchema, payslipLineSchema } from "@/features/money/schemas";
import { applyFieldErrors, isNotFound, messageFrom } from "@/shared/lib/errors";
import { formatMoney } from "@/shared/lib/money";
import type { PayStatementStatus } from "@/shared/lib/status-labels";
import { PERM } from "@/permissions/keys";
import {
  Button,
  Field,
  Input,
  PageFrame,
  PageHeader,
  PageScrollRegion,
  PermGate,
  QueryError,
  Select,
  useConfirm,
  useHasPerm,
  useToast,
} from "@/shared/ui";

export default function PayStatementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const toast = useToast();
  const canGeneratePdf = useHasPerm(PERM.PAYROLL_PAY_STATEMENTS_GENERATE);

  const query = useQuery({
    queryKey: payStatementKeys.detail(id),
    queryFn: () => getPayStatement(id),
    retry: false,
  });

  const ytdQuery = useQuery({
    queryKey: ["employee-ytd", query.data?.employee_id],
    queryFn: () => getEmployeeYtd(query.data!.employee_id),
    enabled: Boolean(query.data?.employee_id),
    retry: false,
  });

  if (query.isError && isNotFound(query.error)) notFound();
  if (query.isLoading) return <Loading />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => query.refetch()} />;
  const stmt = query.data;
  if (!stmt) return null;

  const draft = stmt.status === "draft";

  /** Runs one write at a time. Throws so a form can pin the API's field errors. */
  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: payStatementKeys.detail(id) });
    } finally {
      setBusy(false);
    }
  }

  async function mutate(action: () => Promise<unknown>) {
    try {
      await run(action);
    } catch (err) {
      setError(messageFrom(err));
    }
  }

  async function generatePdf() {
    try {
      await run(() => generatePayStatementPdf(id));
      toast.success("PDF generated — the worker can now download it from their portal.");
    } catch (err) {
      setError(messageFrom(err));
    }
  }

  async function removeRow(what: string, action: () => Promise<unknown>) {
    const ok = await confirm({
      title: `Remove this ${what}?`,
      body: "It will be deleted from this pay statement.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (ok) await mutate(action);
  }

  return (
    <PageFrame>
      <PageHeader
        title={stmt.employee_name}
        actions={<PayStatementStatusBadge status={stmt.status as PayStatementStatus} />}
      />
      <PageScrollRegion className="flex flex-col gap-8">
      <p className="font-body text-sm text-cadence-ink/60">
        Cadence computes <strong>gross only</strong> — deductions here are entered, not calculated.
        This is a pay statement, not an official payslip.
      </p>
      <div className="flex flex-wrap gap-6 font-body text-sm">
        <div>
          <p className="font-fine text-[10px] uppercase text-cadence-ink/60">Gross</p>
          <p className="font-heading text-2xl">{"gross" in stmt ? formatMoney(stmt.gross) : "—"}</p>
        </div>
        <div>
          <p className="font-fine text-[10px] uppercase text-cadence-ink/60">Net</p>
          <p className="font-heading text-2xl">
            {"net_amount" in stmt ? formatMoney(stmt.net_amount) : "—"}
          </p>
        </div>
        <div>
          <p className="font-fine text-[10px] uppercase text-cadence-ink/60">Hours</p>
          <p className="font-heading text-2xl">{stmt.hours_total ?? "—"}</p>
        </div>
        <div className="self-end">
          {stmt.document_id ? (
            <a
              href={`/api/v1/payroll/pay-statements/${id}/pdf/`}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Download PDF
            </a>
          ) : draft ? (
            <p className="text-xs text-cadence-ink/60">The PDF can be generated once the run is approved.</p>
          ) : (
            canGeneratePdf ? (
              <Button size="sm" variant="secondary" disabled={busy} onClick={generatePdf}>
                Generate PDF
              </Button>
            ) : (
              <p className="text-xs text-cadence-ink/60">No PDF generated yet.</p>
            )
          )}
        </div>
      </div>

      {error ? <p role="alert" className="text-sm text-cadence-red">{error}</p> : null}

      <section>
        <h2 className="mb-3 font-subheading text-lg">Shift / earning lines</h2>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {(stmt.lines ?? []).map((line) => (
            <li key={line.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span>
                {line.description ?? line.type} · {line.hours ?? "—"}h
              </span>
              <span className="flex items-center gap-3">
                {"amount" in line ? formatMoney(line.amount) : "—"}
                {draft ? (
                  <PermGate anyOf={PERM.PAYROLL_PAY_STATEMENTS_EDIT}>
                    <button
                      type="button"
                      disabled={busy}
                      className="text-xs text-cadence-red underline disabled:opacity-50"
                      onClick={() => removeRow("earning line", () => deletePayStatementLine(id, line.id))}
                    >
                      Remove
                    </button>
                  </PermGate>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        {draft ? (
          <PermGate anyOf={PERM.PAYROLL_PAY_STATEMENTS_EDIT}>
            <AddEarningForm
              onAdd={(body) =>
                run(() => addPayStatementLine(id, { ...body, description: body.description ?? "" }))
              }
            />
          </PermGate>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 font-subheading text-lg">Deductions</h2>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {(stmt.deduction_lines ?? stmt.deductions ?? []).map((d: { id: string; code: string; amount?: string }) => (
            <li key={d.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span>{d.code}</span>
              <span className="flex items-center gap-3">
                {"amount" in d && d.amount != null ? formatMoney(d.amount) : "—"}
                {draft ? (
                  <PermGate anyOf={PERM.PAYROLL_PAY_STATEMENTS_EDIT}>
                    <button
                      type="button"
                      disabled={busy}
                      className="text-xs text-cadence-red underline disabled:opacity-50"
                      onClick={() => removeRow("deduction", () => deletePayStatementDeduction(id, d.id))}
                    >
                      Remove
                    </button>
                  </PermGate>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        {draft ? (
          <PermGate anyOf={PERM.PAYROLL_PAY_STATEMENTS_EDIT}>
            <AddDeductionForm
              onAdd={(body) => run(() => addPayStatementDeduction(id, body))}
            />
          </PermGate>
        ) : null}
      </section>

      {ytdQuery.data ? (
        <section className="rounded-2xl bg-surface p-4">
          <h2 className="mb-3 font-subheading text-lg">Year to date</h2>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <div>
              <dt className="font-fine text-[10px] uppercase tracking-wide text-cadence-ink/60">
                Tax year
              </dt>
              <dd className="mt-1 font-heading text-xl text-cadence-ink">{ytdQuery.data.tax_year}</dd>
            </div>
            <div>
              <dt className="font-fine text-[10px] uppercase tracking-wide text-cadence-ink/60">
                Gross
              </dt>
              <dd className="mt-1 font-heading text-xl text-cadence-ink">
                {ytdQuery.data.gross != null ? formatMoney(ytdQuery.data.gross) : "—"}
              </dd>
            </div>
            <div>
              <dt className="font-fine text-[10px] uppercase tracking-wide text-cadence-ink/60">
                Net
              </dt>
              <dd className="mt-1 font-heading text-xl text-cadence-ink">
                {ytdQuery.data.net != null ? formatMoney(ytdQuery.data.net) : "—"}
              </dd>
            </div>
            <div>
              <dt className="font-fine text-[10px] uppercase tracking-wide text-cadence-ink/60">
                Hours
              </dt>
              <dd className="mt-1 font-heading text-xl text-cadence-ink">
                {ytdQuery.data.hours_total ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="font-fine text-[10px] uppercase tracking-wide text-cadence-ink/60">
                Deductions
              </dt>
              <dd className="mt-1 font-heading text-xl text-cadence-ink">
                {ytdQuery.data.deductions != null ? formatMoney(ytdQuery.data.deductions) : "—"}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}
      {confirmDialog}
      </PageScrollRegion>
    </PageFrame>
  );
}

const earningFormSchema = payslipLineSchema
  .pick({ description: true, amount: true })
  .extend({ type: z.enum(["bonus", "adjustment", "allowance", "other"]) });
type EarningFormValues = z.infer<typeof earningFormSchema>;
const EARNING_FIELDS = Object.keys(earningFormSchema.shape);

function AddEarningForm({ onAdd }: { onAdd: (body: EarningFormValues) => Promise<void> }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EarningFormValues>({
    resolver: zodResolver(earningFormSchema),
    defaultValues: { type: "bonus", description: "", amount: "" },
  });

  async function submit(values: EarningFormValues) {
    setFormError(null);
    try {
      await onAdd(values);
      reset();
    } catch (err) {
      const banner = applyFieldErrors(setError, err, EARNING_FIELDS);
      if (banner) setFormError(banner);
    }
  }

  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2"
      noValidate
      onSubmit={handleSubmit(submit)}
    >
      <Field label="Type" htmlFor="earn-type" error={errors.type?.message}>
        <Select id="earn-type" {...register("type")}>
          <option value="bonus">Bonus</option>
          <option value="adjustment">Adjustment</option>
          <option value="allowance">Allowance</option>
          <option value="other">Other</option>
        </Select>
      </Field>
      <Field label="Description" htmlFor="earn-desc" error={errors.description?.message}>
        <Input id="earn-desc" {...register("description")} />
      </Field>
      <Field label="Amount" htmlFor="earn-amt" error={errors.amount?.message}>
        <Input id="earn-amt" {...register("amount")} />
      </Field>
      <Button type="submit" size="sm" disabled={isSubmitting}>
        Add earning
      </Button>
      {formError ? <p className="w-full text-sm text-cadence-red">{formError}</p> : null}
    </form>
  );
}

const deductionFormSchema = payslipDeductionSchema.pick({ code: true, amount: true });
type DeductionFormValues = z.infer<typeof deductionFormSchema>;
const DEDUCTION_FIELDS = [...Object.keys(deductionFormSchema.shape), "label"];

function AddDeductionForm({
  onAdd,
}: {
  onAdd: (body: DeductionFormValues & { label: string }) => Promise<void>;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DeductionFormValues>({
    resolver: zodResolver(deductionFormSchema),
    defaultValues: { code: "cpp", amount: "" },
  });

  async function submit(values: DeductionFormValues) {
    setFormError(null);
    try {
      await onAdd({ ...values, label: values.code });
      reset({ code: values.code, amount: "" });
    } catch (err) {
      const banner = applyFieldErrors(setError, err, DEDUCTION_FIELDS);
      if (banner) setFormError(banner);
    }
  }

  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2"
      noValidate
      onSubmit={handleSubmit(submit)}
    >
      <Field label="Code" htmlFor="ded-code" error={errors.code?.message}>
        <Select id="ded-code" {...register("code")}>
          <option value="cpp">CPP</option>
          <option value="ei">EI</option>
          <option value="federal_tax">Federal tax</option>
          <option value="provincial_tax">Provincial tax</option>
          <option value="other">Other</option>
        </Select>
      </Field>
      <Field label="Amount" htmlFor="ded-amt" error={errors.amount?.message}>
        <Input id="ded-amt" {...register("amount")} />
      </Field>
      <Button type="submit" size="sm" disabled={isSubmitting}>
        Add deduction
      </Button>
      {formError ? <p className="w-full text-sm text-cadence-red">{formError}</p> : null}
    </form>
  );
}
