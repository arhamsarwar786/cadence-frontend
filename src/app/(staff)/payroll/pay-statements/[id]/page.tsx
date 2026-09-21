"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notFound, useParams } from "next/navigation";
import { useState } from "react";
import {
  addPayStatementDeduction,
  addPayStatementLine,
  deletePayStatementDeduction,
  deletePayStatementLine,
} from "@/features/money/actions";
import { getEmployeeYtd, getPayStatement, payStatementKeys } from "@/features/money/api";
import { PayStatementStatusBadge } from "@/features/money/components/StatusBadges";
import { isNotFound, messageFrom } from "@/shared/lib/errors";
import { formatMoney } from "@/shared/lib/money";
import type { PayStatementStatus } from "@/shared/lib/status-labels";
import { PERM } from "@/permissions/keys";
import { Button, Field, Input, PageHeader, PermGate, Select } from "@/shared/ui";

export default function PayStatementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

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
  if (query.isLoading) return <p className="font-body text-sm text-cadence-ink/60">Loading…</p>;
  if (query.isError) return <p className="font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>;
  const stmt = query.data;
  if (!stmt) return null;

  const draft = stmt.status === "draft";

  async function mutate(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: payStatementKeys.detail(id) });
    } catch (err) {
      setError(messageFrom(err));
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={stmt.employee_name}
        actions={<PayStatementStatusBadge status={stmt.status as PayStatementStatus} />}
      />
      <p className="font-body text-sm text-cadence-ink/60">
        Cadence computes <strong>gross only</strong> — deductions here are entered, not calculated.
        This is a pay statement, not an official payslip.
      </p>
      <div className="flex flex-wrap gap-6 font-body text-sm">
        <div>
          <p className="font-fine text-[10px] uppercase text-cadence-ink/40">Gross</p>
          <p className="font-heading text-2xl">{"gross" in stmt ? formatMoney(stmt.gross) : "—"}</p>
        </div>
        <div>
          <p className="font-fine text-[10px] uppercase text-cadence-ink/40">Net</p>
          <p className="font-heading text-2xl">
            {"net_amount" in stmt ? formatMoney(stmt.net_amount) : "—"}
          </p>
        </div>
        <div>
          <p className="font-fine text-[10px] uppercase text-cadence-ink/40">Hours</p>
          <p className="font-heading text-2xl">{stmt.hours_total ?? "—"}</p>
        </div>
        <a
          href={`/api/v1/payroll/pay-statements/${id}/pdf/`}
          target="_blank"
          rel="noreferrer"
          className="self-end underline"
        >
          PDF
        </a>
      </div>

      {error ? <p className="text-sm text-cadence-red">{error}</p> : null}

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
                      className="text-xs text-cadence-red underline"
                      onClick={() => mutate(() => deletePayStatementLine(id, line.id))}
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
              onAdd={(body) => mutate(() => addPayStatementLine(id, body))}
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
                      className="text-xs text-cadence-red underline"
                      onClick={() => mutate(() => deletePayStatementDeduction(id, d.id))}
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
              onAdd={(body) => mutate(() => addPayStatementDeduction(id, body))}
            />
          </PermGate>
        ) : null}
      </section>

      {ytdQuery.data ? (
        <section className="rounded-2xl bg-surface p-4">
          <h2 className="mb-2 font-subheading text-lg">Year to date</h2>
          <pre className="overflow-auto font-fine text-xs text-cadence-ink/70">
            {JSON.stringify(ytdQuery.data, null, 2)}
          </pre>
        </section>
      ) : null}
    </div>
  );
}

function AddEarningForm({
  onAdd,
}: {
  onAdd: (body: {
    type: "bonus" | "adjustment" | "allowance" | "other";
    description: string;
    amount: string;
    hours?: string | null;
  }) => void;
}) {
  const [lineType, setLineType] = useState<"bonus" | "adjustment" | "allowance" | "other">("bonus");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onAdd({ type: lineType, description, amount });
        setDescription("");
        setAmount("");
      }}
    >
      <Field label="Type" htmlFor="earn-type">
        <Select id="earn-type" value={lineType} onChange={(e) => setLineType(e.target.value as typeof lineType)}>
          <option value="bonus">Bonus</option>
          <option value="adjustment">Adjustment</option>
          <option value="allowance">Allowance</option>
          <option value="other">Other</option>
        </Select>
      </Field>
      <Field label="Description" htmlFor="earn-desc">
        <Input id="earn-desc" value={description} onChange={(e) => setDescription(e.target.value)} required />
      </Field>
      <Field label="Amount" htmlFor="earn-amt">
        <Input id="earn-amt" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      </Field>
      <Button type="submit" size="sm">
        Add earning
      </Button>
    </form>
  );
}

function AddDeductionForm({
  onAdd,
}: {
  onAdd: (body: {
    code: "cpp" | "ei" | "federal_tax" | "provincial_tax" | "other";
    amount: string;
    label: string;
  }) => void;
}) {
  const [code, setCode] = useState<"cpp" | "ei" | "federal_tax" | "provincial_tax" | "other">("cpp");
  const [amount, setAmount] = useState("");
  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onAdd({ code, amount, label: code });
        setAmount("");
      }}
    >
      <Field label="Code" htmlFor="ded-code">
        <Select id="ded-code" value={code} onChange={(e) => setCode(e.target.value as typeof code)}>
          <option value="cpp">CPP</option>
          <option value="ei">EI</option>
          <option value="federal_tax">Federal tax</option>
          <option value="provincial_tax">Provincial tax</option>
          <option value="other">Other</option>
        </Select>
      </Field>
      <Field label="Amount" htmlFor="ded-amt">
        <Input id="ded-amt" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      </Field>
      <Button type="submit" size="sm">
        Add deduction
      </Button>
    </form>
  );
}
