"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useSession } from "@/auth/session-context";
import { useOrgTimeZone } from "@/auth/use-org-timezone";
import { recordWorkerConsent } from "@/features/workers/actions";
import type { Employee } from "@/features/workers/types";
import { PERM } from "@/permissions/keys";
import { formatDateTime } from "@/shared/lib/datetime";
import { messageFrom } from "@/shared/lib/errors";
import { CONSENT_SOURCE_LABELS, type ConsentSource } from "@/shared/lib/status-labels";
import { Button, Dialog, useHasPerm, useToast } from "@/shared/ui";

/** The worker's latest consent capture, plus the office's door for consent
 * collected OFFLINE (paper, in person). The worker's own capture lives in
 * the portal; this records `source = staff` and snapshots the org's
 * CURRENT consent text. Recording rides workers.create (intake work). */
export function ConsentPanel({
  worker,
  onRefetch,
}: {
  worker: Employee;
  onRefetch?: () => unknown;
}) {
  const timeZone = useOrgTimeZone();
  const { session } = useSession();
  const canRecord = useHasPerm(PERM.WORKERS_CREATE);
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const consent = worker.consent;
  const orgVersion = session?.organization.consent_version ?? 0;
  const orgText = session?.organization.consent_text ?? "";
  const outdated = Boolean(consent && orgVersion > 0 && consent.version < orgVersion);

  const mutation = useMutation({
    mutationFn: () => recordWorkerConsent(worker.id),
    onSuccess: async () => {
      await onRefetch?.();
      toast.success("Consent recorded.");
      setOpen(false);
    },
  });

  function close() {
    // Escape / backdrop close the native dialog regardless, so state always
    // follows; an in-flight record still lands and refetches.
    if (!mutation.isPending) mutation.reset();
    setOpen(false);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-subheading text-xl text-cadence-ink">Consent</h2>
        {canRecord && orgVersion > 0 ? (
          <Button size="sm" variant={consent ? "secondary" : "primary"} onClick={() => setOpen(true)}>
            {consent ? "Record new consent" : "Record consent"}
          </Button>
        ) : null}
      </div>
      {canRecord && orgVersion === 0 ? (
        <p className="font-body text-sm text-cadence-ink/60">
          Your agency has no consent text yet, so consent can&apos;t be recorded. A root user sets
          it in{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>
          .
        </p>
      ) : null}
      {outdated ? (
        <p className="rounded-lg bg-cadence-yellow/25 px-3 py-2 font-body text-sm text-cadence-ink">
          This consent is for version {consent?.version}; your agency&apos;s current text is version{" "}
          {orgVersion}.
        </p>
      ) : null}
      {consent ? (
        <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-2 font-body text-sm sm:grid-cols-2">
          <div>
            <dt className="text-cadence-ink/60">Version</dt>
            <dd className="text-cadence-ink">{consent.version}</dd>
          </div>
          <div>
            <dt className="text-cadence-ink/60">Source</dt>
            <dd className="text-cadence-ink">{CONSENT_SOURCE_LABELS[consent.source as ConsentSource]}</dd>
          </div>
          <div>
            <dt className="text-cadence-ink/60">Captured</dt>
            <dd className="text-cadence-ink">
              {timeZone ? formatDateTime(consent.created_at, timeZone) : "—"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-cadence-ink/60">Text agreed to</dt>
            <dd className="whitespace-pre-wrap text-cadence-ink">{consent.text}</dd>
          </div>
        </dl>
      ) : (
        <p className="font-body text-sm text-cadence-ink/60">No consent captured yet.</p>
      )}

      {open ? (
        <Dialog open onClose={close} title="Record consent">
          <div className="flex flex-col gap-4">
            <p className="font-body text-sm text-on-card-muted">
              Only record this if {worker.first_name} {worker.last_name} has agreed to the text
              below (for example on paper or in person). It is saved as staff-recorded consent to
              version {orgVersion}.
            </p>
            <div className="scroll-area-y max-h-56 whitespace-pre-wrap rounded-xl border border-current/15 p-3 font-body text-sm">
              {orgText || "—"}
            </div>
            {mutation.isError ? (
              <p role="alert" className="text-sm text-cadence-red">
                {messageFrom(mutation.error)}
              </p>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={close} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                {mutation.isPending ? "Recording…" : "Record consent"}
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </section>
  );
}
