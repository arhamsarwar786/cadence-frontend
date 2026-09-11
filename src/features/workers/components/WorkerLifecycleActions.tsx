"use client";

import { useState } from "react";
import {
  approveWorker,
  deactivateWorker,
  rehireWorker,
  submitWorker,
} from "@/features/workers/actions";
import type { Employee } from "@/features/workers/types";
import { messageFrom } from "@/shared/lib/errors";
import { Button } from "@/shared/ui";

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
          <Button disabled={pending} onClick={() => run(() => submitWorker(worker.id))}>
            Submit for onboarding
          </Button>
        ) : null}
        {worker.lifecycle_status === "onboarding" ? (
          <Button disabled={pending} onClick={() => run(() => approveWorker(worker.id))}>
            Approve
          </Button>
        ) : null}
        {worker.lifecycle_status === "active" ? (
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => run(() => deactivateWorker(worker.id))}
          >
            Deactivate
          </Button>
        ) : null}
        {worker.lifecycle_status === "out" ? (
          <Button disabled={pending} onClick={() => run(() => rehireWorker(worker.id))}>
            Rehire
          </Button>
        ) : null}
      </div>
      {error ? <p className="font-body text-xs text-cadence-red">{error}</p> : null}
    </div>
  );
}
