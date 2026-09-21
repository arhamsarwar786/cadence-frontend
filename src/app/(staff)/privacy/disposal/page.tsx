"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  delayDisposal,
  destroyDisposal,
  holdDisposal,
  releaseDisposal,
} from "@/features/privacy/disposal-actions";
import {
  disposalKeys,
  listDisposalSchedules,
  type DestructionSchedule,
} from "@/features/privacy/disposal-api";
import { PERM } from "@/permissions/keys";
import { messageFrom } from "@/shared/lib/errors";
import {
  Button,
  Chip,
  Dialog,
  Field,
  Input,
  ListSkeleton,
  PageHeader,
  Pagination,
  PermGate,
  Table,
  Textarea,
  type Column,
} from "@/shared/ui";

const PAGE_SIZE = 50;
const DESTROY_CONFIRM = "DESTROY";

type DisposalState = "held" | "due" | "scheduled";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function disposalState(row: DestructionSchedule): DisposalState {
  if (row.destruction_hold_reason.trim()) return "held";
  if (row.destruction_due_on <= todayIso()) return "due";
  return "scheduled";
}

function stateLabel(state: DisposalState): string {
  if (state === "held") return "Held";
  if (state === "due") return "Due now";
  return "Scheduled";
}

function stateTone(state: DisposalState): "danger" | "yellow" | "muted" {
  if (state === "held") return "yellow";
  if (state === "due") return "danger";
  return "muted";
}

type ActionKind = "delay" | "hold" | "destroy";

export default function DisposalSchedulePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const queryClient = useQueryClient();

  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ kind: ActionKind; row: DestructionSchedule } | null>(null);
  const [delayDueOn, setDelayDueOn] = useState("");
  const [holdReason, setHoldReason] = useState("");
  const [destroyTyped, setDestroyTyped] = useState("");

  const query = useQuery({
    queryKey: disposalKeys.list({ page, pageSize: PAGE_SIZE }),
    queryFn: () => listDisposalSchedules({ page, pageSize: PAGE_SIZE }),
  });

  const rows = query.data?.results ?? [];

  const counts = useMemo(() => {
    let held = 0;
    let due = 0;
    let scheduled = 0;
    for (const row of rows) {
      const state = disposalState(row);
      if (state === "held") held += 1;
      else if (state === "due") due += 1;
      else scheduled += 1;
    }
    return { held, due, scheduled };
  }, [rows]);

  function closeDialog() {
    setDialog(null);
    setDelayDueOn("");
    setHoldReason("");
    setDestroyTyped("");
    setActionError(null);
  }

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: disposalKeys.all });
  }

  async function runAction(id: string, act: () => Promise<unknown>) {
    setActionError(null);
    setBusyId(id);
    try {
      await act();
      await invalidate();
      closeDialog();
    } catch (error) {
      setActionError(messageFrom(error));
    } finally {
      setBusyId(null);
    }
  }

  const columns: Column<DestructionSchedule>[] = [
    {
      header: "State",
      cell: (row) => {
        const state = disposalState(row);
        return <Chip tone={stateTone(state)}>{stateLabel(state)}</Chip>;
      },
    },
    {
      header: "Employee id",
      cell: (row) => (
        <span className="font-fine text-xs text-cadence-ink/70">{row.employee_id}</span>
      ),
    },
    { header: "Scheduled on", cell: (row) => row.destruction_scheduled_on },
    { header: "Due on", cell: (row) => row.destruction_due_on },
    {
      header: "Notified",
      cell: (row) => row.destruction_notified_at?.slice(0, 10) ?? "—",
    },
    {
      header: "Hold reason",
      cell: (row) =>
        row.destruction_hold_reason.trim() ? (
          <span className="line-clamp-2 max-w-xs">{row.destruction_hold_reason}</span>
        ) : (
          "—"
        ),
    },
    {
      header: "Actions",
      cell: (row) => {
        const state = disposalState(row);
        const busy = busyId === row.id;
        return (
          <PermGate anyOf={PERM.PRIVACY_DISPOSAL_MANAGE}>
            <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setActionError(null);
                  setDelayDueOn(row.destruction_due_on);
                  setDialog({ kind: "delay", row });
                }}
              >
                Delay
              </Button>
              {state === "held" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => runAction(row.id, () => releaseDisposal(row.id))}
                >
                  Release
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setActionError(null);
                    setHoldReason("");
                    setDialog({ kind: "hold", row });
                  }}
                >
                  Hold
                </Button>
              )}
              <Button
                size="sm"
                variant="danger"
                disabled={busy}
                onClick={() => {
                  setActionError(null);
                  setDestroyTyped("");
                  setDialog({ kind: "destroy", row });
                }}
              >
                Destroy now
              </Button>
            </div>
          </PermGate>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Disposal schedule" />
      <p className="font-body text-sm text-cadence-ink/60">
        Scheduled destruction of departed worker personal records. Rows show identifiers and dates
        only — never names.
      </p>

      {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError ? (
        <p className="font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-4 font-body text-sm text-cadence-ink/65">
            <span>
              <strong className="text-cadence-ink">{counts.due}</strong> due now
            </span>
            <span>
              <strong className="text-cadence-ink">{counts.held}</strong> held
            </span>
            <span>
              <strong className="text-cadence-ink">{counts.scheduled}</strong> scheduled
            </span>
          </div>
          <Table
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            emptyMessage="No disposal schedules."
          />
          {query.data ? (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              count={query.data.count}
              onPageChange={(p) => router.push(`/privacy/disposal?page=${p}`)}
            />
          ) : null}
        </>
      )}

      <Dialog
        open={dialog?.kind === "delay"}
        onClose={closeDialog}
        title="Delay destruction"
      >
        <div className="flex flex-col gap-4">
          <p className="font-body text-sm text-cadence-ink/60">
            Schedule id <span className="font-fine text-xs">{dialog?.row.id}</span>
          </p>
          <Field label="New due date" htmlFor="disposal-delay-due">
            <Input
              id="disposal-delay-due"
              type="date"
              value={delayDueOn}
              onChange={(e) => setDelayDueOn(e.target.value)}
            />
          </Field>
          {actionError ? <p className="font-body text-sm text-cadence-red">{actionError}</p> : null}
          <div className="flex gap-2">
            <Button
              disabled={!delayDueOn || busyId === dialog?.row.id}
              onClick={() => {
                if (!dialog) return;
                void runAction(dialog.row.id, () =>
                  delayDisposal(dialog.row.id, { due_on: delayDueOn }),
                );
              }}
            >
              Save delay
            </Button>
            <Button type="button" variant="secondary" onClick={closeDialog}>
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={dialog?.kind === "hold"} onClose={closeDialog} title="Hold destruction">
        <div className="flex flex-col gap-4">
          <p className="font-body text-sm text-cadence-ink/60">
            A hold requires a recorded reason. Whitespace alone is refused.
          </p>
          <Field label="Reason" htmlFor="disposal-hold-reason">
            <Textarea
              id="disposal-hold-reason"
              value={holdReason}
              onChange={(e) => setHoldReason(e.target.value)}
              rows={3}
            />
          </Field>
          {actionError ? <p className="font-body text-sm text-cadence-red">{actionError}</p> : null}
          <div className="flex gap-2">
            <Button
              disabled={!holdReason.trim() || busyId === dialog?.row.id}
              onClick={() => {
                if (!dialog) return;
                void runAction(dialog.row.id, () =>
                  holdDisposal(dialog.row.id, { reason: holdReason }),
                );
              }}
            >
              Place hold
            </Button>
            <Button type="button" variant="secondary" onClick={closeDialog}>
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={dialog?.kind === "destroy"} onClose={closeDialog} title="Destroy now">
        <div className="flex flex-col gap-4">
          <p className="font-body text-sm text-cadence-ink/70">
            This permanently destroys the encrypted personal record for employee{" "}
            <span className="font-fine text-xs">{dialog?.row.employee_id}</span>. This cannot be
            undone.
          </p>
          <Field
            label={`Type ${DESTROY_CONFIRM} to confirm`}
            htmlFor="disposal-destroy-confirm"
          >
            <Input
              id="disposal-destroy-confirm"
              value={destroyTyped}
              onChange={(e) => setDestroyTyped(e.target.value)}
              autoComplete="off"
              placeholder={DESTROY_CONFIRM}
            />
          </Field>
          {actionError ? <p className="font-body text-sm text-cadence-red">{actionError}</p> : null}
          <div className="flex gap-2">
            <Button
              variant="danger"
              disabled={destroyTyped !== DESTROY_CONFIRM || busyId === dialog?.row.id}
              onClick={() => {
                if (!dialog) return;
                void runAction(dialog.row.id, () => destroyDisposal(dialog.row.id));
              }}
            >
              Destroy now
            </Button>
            <Button type="button" variant="secondary" onClick={closeDialog}>
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
