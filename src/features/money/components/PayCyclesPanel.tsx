"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { fetchAllPages } from "@/api/client";
import { createPayCycle, deletePayCycle, updatePayCycle } from "@/features/money/actions";
import { listPayCycles, payCycleKeys } from "@/features/money/api";
import { payCycleSchema, type PayCycleFormValues } from "@/features/money/schemas";
import type { PayCycle, PayCycleCreate } from "@/features/money/types";
import { PERM } from "@/permissions/keys";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import {
  Button,
  Chip,
  Dialog,
  Field,
  Input,
  Loading,
  QueryError,
  Select,
  useConfirm,
  useHasPerm,
  useToast,
} from "@/shared/ui";

const FIELD_NAMES = [
  "name",
  "period_kind",
  "period_days",
  "anchor_date",
  "payday_offset_days",
  "active",
] as const;

export function describeCycle(cycle: PayCycle): string {
  const grid =
    cycle.period_kind === "monthly"
      ? "Monthly"
      : `Every ${cycle.period_days ?? "?"} day${cycle.period_days === 1 ? "" : "s"}`;
  const offset = cycle.payday_offset_days;
  const payday =
    offset === 0 ? "payday on the period end" : `payday ${offset} day${offset === 1 ? "" : "s"} after`;
  return `${grid} from ${cycle.anchor_date} · ${payday}`;
}

function toBody(values: PayCycleFormValues): PayCycleCreate {
  return {
    name: values.name.trim(),
    period_kind: values.period_kind,
    period_days: values.period_kind === "fixed" ? Number(values.period_days) : null,
    anchor_date: values.anchor_date,
    payday_offset_days: Number(values.payday_offset_days),
    active: values.active,
  };
}

function PayCycleForm({
  cycle,
  hasOtherActive,
  onDone,
  onCancel,
}: {
  cycle: PayCycle | null;
  hasOtherActive: boolean;
  onDone: (saved: PayCycle) => void;
  onCancel: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PayCycleFormValues>({
    resolver: zodResolver(payCycleSchema),
    defaultValues: cycle
      ? {
          name: cycle.name,
          period_kind: cycle.period_kind ?? "fixed",
          period_days: cycle.period_days != null ? String(cycle.period_days) : "",
          anchor_date: cycle.anchor_date,
          payday_offset_days: String(cycle.payday_offset_days),
          active: Boolean(cycle.active),
        }
      : {
          name: "",
          period_kind: "fixed",
          period_days: "14",
          anchor_date: "",
          payday_offset_days: "",
          // Only one cycle can be active; a second one arrives as a draft.
          active: !hasOtherActive,
        },
  });
  const kind = useWatch({ control, name: "period_kind" });
  const prefix = cycle ? `cycle-${cycle.id}` : "cycle-new";

  async function submit(values: PayCycleFormValues) {
    if (isSubmitting) return;
    setFormError(null);
    try {
      const body = toBody(values);
      const saved = cycle ? await updatePayCycle(cycle.id, body) : await createPayCycle(body);
      onDone(saved);
    } catch (error) {
      const banner = applyFieldErrors(setError, error, FIELD_NAMES);
      if (banner) setFormError(banner);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
      <Field label="Name" htmlFor={`${prefix}-name`} error={errors.name?.message}>
        <Input
          id={`${prefix}-name`}
          autoComplete="off"
          aria-invalid={errors.name ? true : undefined}
          {...register("name")}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Period" htmlFor={`${prefix}-kind`} error={errors.period_kind?.message}>
          <Select id={`${prefix}-kind`} {...register("period_kind")}>
            <option value="fixed">Fixed number of days</option>
            <option value="monthly">Monthly</option>
          </Select>
        </Field>
        {kind === "fixed" ? (
          <Field
            label="Period length (days)"
            htmlFor={`${prefix}-days`}
            error={errors.period_days?.message}
            hint="7 weekly, 14 bi-weekly."
          >
            <Input
              id={`${prefix}-days`}
              inputMode="numeric"
              aria-invalid={errors.period_days ? true : undefined}
              {...register("period_days")}
            />
          </Field>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Anchor date"
          htmlFor={`${prefix}-anchor`}
          error={errors.anchor_date?.message}
          hint="The first day of any pay period."
        >
          <Input
            id={`${prefix}-anchor`}
            type="date"
            aria-invalid={errors.anchor_date ? true : undefined}
            {...register("anchor_date")}
          />
        </Field>
        <Field
          label="Payday offset (days)"
          htmlFor={`${prefix}-offset`}
          error={errors.payday_offset_days?.message}
          hint="Days after the period ends, 0 to 60."
        >
          <Input
            id={`${prefix}-offset`}
            inputMode="numeric"
            aria-invalid={errors.payday_offset_days ? true : undefined}
            {...register("payday_offset_days")}
          />
        </Field>
      </div>
      <label className="flex items-start gap-3 font-body text-sm">
        <input type="checkbox" className="mt-1" {...register("active")} />
        <span>
          Active
          <span className="block text-xs text-on-card-muted">
            &ldquo;Generate next run&rdquo; uses the one active cycle. Only one can be active at a time.
          </span>
        </span>
      </label>
      {errors.active?.message ? <p className="text-xs text-cadence-red">{errors.active.message}</p> : null}
      {formError ? (
        <p role="alert" className="font-body text-sm text-cadence-red">
          {formError}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : cycle ? "Save cycle" : "Create cycle"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * The pay-cycle config on /payroll: list, create, edit, (de)activate, delete.
 * Every door rides payroll.run, so the whole panel is hidden without it. A
 * cycle that has generated runs is frozen history — the API refuses edits
 * other than deactivation and refuses deletion, in its own words.
 */
export function PayCyclesPanel() {
  const canRun = useHasPerm(PERM.PAYROLL_RUN);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [editing, setEditing] = useState<PayCycle | "new" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: payCycleKeys.list(),
    queryFn: async () => (await fetchAllPages((page) => listPayCycles(page))).results,
    enabled: canRun,
  });

  if (!canRun) return null;
  const cycles = query.data ?? [];
  const active = cycles.find((c) => c.active);

  function refresh() {
    return queryClient.invalidateQueries({ queryKey: payCycleKeys.all });
  }

  async function act(cycle: PayCycle, fn: () => Promise<unknown>, success: string) {
    if (busyId) return;
    setBusyId(cycle.id);
    try {
      await fn();
      await refresh();
      toast.success(success);
    } catch (error) {
      toast.error(messageFrom(error));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(cycle: PayCycle) {
    const ok = await confirm({
      title: `Delete ${cycle.name}?`,
      body: cycle.active
        ? "This is the active cycle — without one, “Generate next run” has nothing to follow. A cycle that has generated runs can't be deleted; deactivate it instead."
        : "A cycle that has generated runs can't be deleted; deactivate it instead.",
      confirmLabel: "Delete cycle",
      danger: true,
    });
    if (ok) await act(cycle, () => deletePayCycle(cycle.id), `Deleted ${cycle.name}.`);
  }

  async function handleToggle(cycle: PayCycle) {
    if (cycle.active) {
      await act(cycle, () => updatePayCycle(cycle.id, { active: false }), `${cycle.name} deactivated.`);
      return;
    }
    if (active) {
      const ok = await confirm({
        title: `Activate ${cycle.name}?`,
        body: `Only one cycle can be active. ${active.name} will be deactivated first.`,
        confirmLabel: "Activate",
      });
      if (!ok) return;
      await act(
        cycle,
        async () => {
          await updatePayCycle(active.id, { active: false });
          try {
            await updatePayCycle(cycle.id, { active: true });
          } catch (error) {
            // Put the previous schedule back so payroll is never left without one.
            await updatePayCycle(active.id, { active: true }).catch(() => undefined);
            throw error;
          }
        },
        `${cycle.name} is now the active cycle.`,
      );
      return;
    }
    await act(cycle, () => updatePayCycle(cycle.id, { active: true }), `${cycle.name} is now the active cycle.`);
  }

  return (
    <section
      aria-labelledby="pay-cycles-heading"
      className="flex shrink-0 flex-col gap-2 rounded-2xl border border-border bg-surface p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="pay-cycles-heading"
          className="font-subheading text-sm uppercase tracking-wide text-cadence-ink/50"
        >
          Pay cycles
        </h2>
        <Button size="sm" variant="secondary" onClick={() => setEditing("new")}>
          New cycle
        </Button>
      </div>
      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => query.refetch()} />
      ) : cycles.length === 0 ? (
        <p className="text-sm text-cadence-ink/50">No pay cycles configured yet.</p>
      ) : (
        <ul className="max-h-44 divide-y divide-border overflow-y-auto overscroll-y-contain text-sm">
          {cycles.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="break-words font-medium text-cadence-ink">{c.name}</span>
                  <Chip tone={c.active ? "success" : "muted"}>{c.active ? "Active" : "Inactive"}</Chip>
                </p>
                <p className="text-cadence-ink/60">{describeCycle(c)}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Edit ${c.name}`}
                  disabled={busyId !== null}
                  onClick={() => setEditing(c)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`${c.active ? "Deactivate" : "Activate"} ${c.name}`}
                  disabled={busyId !== null}
                  onClick={() => handleToggle(c)}
                >
                  {c.active ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-cadence-red"
                  aria-label={`Delete ${c.name}`}
                  disabled={busyId !== null}
                  onClick={() => handleDelete(c)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing && editing !== "new" ? "Edit pay cycle" : "New pay cycle"}
      >
        {editing ? (
          <PayCycleForm
            key={editing === "new" ? "new" : editing.id}
            cycle={editing === "new" ? null : editing}
            hasOtherActive={Boolean(active && (editing === "new" || active.id !== editing.id))}
            onCancel={() => setEditing(null)}
            onDone={async (saved) => {
              const isNew = editing === "new";
              setEditing(null);
              await refresh();
              toast.success(isNew ? `Created ${saved.name}.` : `Saved ${saved.name}.`);
            }}
          />
        ) : null}
      </Dialog>
      {confirmDialog}
    </section>
  );
}
