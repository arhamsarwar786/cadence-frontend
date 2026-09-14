"use client";

import { useState } from "react";
import {
  approveWorker,
  deactivateWorker,
  rehireWorker,
  submitWorker,
} from "@/features/workers/actions";
import type { Employee } from "@/features/workers/types";
import { PERM } from "@/permissions/keys";
import { messageFrom } from "@/shared/lib/errors";
import { Button, PermGate, useConfirm } from "@/shared/ui";

/**
 * applicant --submit--> onboarding --approve--> active --deactivate--> out
 * --rehire--> active (ARCHITECTURE.md §5/§5.2). One act per state, never a
 * status <select>.
 */
export function WorkerLifecycleActions({
  worker,
  onChanged,
}: {
  worker: Employee;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  async function run(action: () => Promise<Employee>) {
    setPending(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {worker.lifecycle_status === "applicant" ? (
          <PermGate anyOf={PERM.WORKERS_EDIT}>
            <Button disabled={pending} onClick={() => run(() => submitWorker(worker.id))}>
              Submit for onboarding
            </Button>
          </PermGate>
        ) : null}
        {worker.lifecycle_status === "onboarding" ? (
          <PermGate anyOf={PERM.WORKERS_ONBOARDING_APPROVE}>
            <Button disabled={pending} onClick={() => run(() => approveWorker(worker.id))}>
              Approve
            </Button>
          </PermGate>
        ) : null}
        {worker.lifecycle_status === "active" ? (
          <PermGate anyOf={PERM.WORKERS_DEACTIVATE}>
            <Button
              variant="danger"
              disabled={pending}
              onClick={async () => {
                const ok = await confirm({
                  title: "Deactivate this worker?",
                  body: "They move to Out and are no longer bookable. Rehire is a separate act.",
                  confirmLabel: "Deactivate",
                  danger: true,
                });
                if (ok) await run(() => deactivateWorker(worker.id));
              }}
            >
              Deactivate
            </Button>
          </PermGate>
        ) : null}
        {worker.lifecycle_status === "out" ? (
          <PermGate anyOf={PERM.WORKERS_EDIT}>
            <Button disabled={pending} onClick={() => run(() => rehireWorker(worker.id))}>
              Rehire
            </Button>
          </PermGate>
        ) : null}
      </div>
      {error ? <p className="font-body text-xs text-cadence-red">{error}</p> : null}
      {dialog}
    </div>
  );
}
