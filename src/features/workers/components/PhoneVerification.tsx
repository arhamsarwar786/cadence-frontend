"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useOrgTimeZone } from "@/auth/use-org-timezone";
import { confirmPhoneCode, requestPhoneCode } from "@/features/workers/actions";
import { workerKeys } from "@/features/workers/api";
import type { Employee } from "@/features/workers/types";
import { PERM } from "@/permissions/keys";
import { formatDateTime, formatTime } from "@/shared/lib/datetime";
import { messageFrom } from "@/shared/lib/errors";
import { Button, Chip, Dialog, Field, Input, useHasPerm, useToast } from "@/shared/ui";

type VerificationState = "verified" | "pending" | "unverified";

function stateOf(worker: Employee, now = Date.now()): VerificationState {
  if (worker.phone_verified_at) return "verified";
  if (worker.phone_code_expires_at && Date.parse(worker.phone_code_expires_at) > now) {
    return "pending";
  }
  return "unverified";
}

/**
 * The worker's mobile + its verification state, with the staff-mediated
 * handshake: the office sends a code to the worker's handset, the worker
 * reads it back, the office confirms it. The code never reaches this
 * screen from the server — only the worker's phone has it. Gated by
 * workers.edit (both backend doors ride it).
 */
export function PhoneVerification({ worker }: { worker: Employee }) {
  const canEdit = useHasPerm(PERM.WORKERS_EDIT);
  const timeZone = useOrgTimeZone();
  const [open, setOpen] = useState(false);
  const state = stateOf(worker);
  const phone = worker.phone?.trim() || "";

  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex flex-wrap items-center gap-1.5">
        <span>{phone || "—"}</span>
        {phone ? (
          state === "verified" ? (
            <Chip tone="success">
              <span
                title={
                  timeZone && worker.phone_verified_at
                    ? `Verified ${formatDateTime(worker.phone_verified_at, timeZone)}`
                    : undefined
                }
              >
                Verified
              </span>
            </Chip>
          ) : state === "pending" ? (
            <Chip tone="yellow">Code sent</Chip>
          ) : (
            <Chip tone="muted">Unverified</Chip>
          )
        ) : null}
      </span>
      {canEdit && phone && state !== "verified" ? (
        <Button
          size="sm"
          variant="secondary"
          className="self-start"
          onClick={() => setOpen(true)}
        >
          {state === "pending" ? "Enter code" : "Verify phone"}
        </Button>
      ) : null}
      {canEdit && !phone ? (
        <span className="text-xs text-cadence-ink/55">
          Add a mobile number in More → Profile to verify it.
        </span>
      ) : null}
      {open ? (
        <PhoneVerificationDialog
          worker={worker}
          initialStep={state === "pending" ? "code" : "send"}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

function PhoneVerificationDialog({
  worker,
  initialStep,
  onClose,
}: {
  worker: Employee;
  initialStep: "send" | "code";
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const timeZone = useOrgTimeZone();
  const codeId = useId();
  const errorId = useId();
  const [step, setStep] = useState<"send" | "code">(initialStep);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(worker.phone_code_expires_at ?? null);

  function store(updated: Employee) {
    queryClient.setQueryData(workerKeys.detail(worker.id), updated);
  }

  const sendMutation = useMutation({
    mutationFn: () => requestPhoneCode(worker.id),
    onMutate: () => {
      setError(null);
      setNotice(null);
    },
    onSuccess: (updated) => {
      store(updated);
      setExpiresAt(updated.phone_code_expires_at ?? null);
      setCode("");
      setNotice(step === "code" ? "A new code was sent. Earlier codes no longer work." : null);
      setStep("code");
    },
    onError: (err) => setError(messageFrom(err)),
  });

  const confirmMutation = useMutation({
    mutationFn: (value: string) => confirmPhoneCode(worker.id, value),
    onMutate: () => {
      setError(null);
      setNotice(null);
    },
    onSuccess: (updated) => {
      store(updated);
      toast.success("Phone number verified.");
      onClose();
    },
    onError: (err) => {
      setError(messageFrom(err));
      // A failed confirm may have voided or expired the code server-side.
      void queryClient.invalidateQueries({ queryKey: workerKeys.detail(worker.id) });
    },
  });

  const busy = sendMutation.isPending || confirmMutation.isPending;
  const trimmed = code.replace(/\s+/g, "");

  return (
    <Dialog open onClose={onClose} title="Verify phone number">
      {step === "send" ? (
        <div className="flex flex-col gap-4">
          <p className="font-body text-sm text-on-card-muted">
            We&apos;ll text a 6-digit code to <strong className="text-on-card">{worker.phone}</strong>.
            Ask {worker.first_name} to read it back to you, then enter it on the next step.
          </p>
          {error ? (
            <p role="alert" className="text-sm text-cadence-red">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => sendMutation.mutate()} disabled={busy}>
              {sendMutation.isPending ? "Sending…" : "Send verification code"}
            </Button>
          </div>
        </div>
      ) : (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!trimmed) {
              setError("Enter the code the worker received.");
              return;
            }
            confirmMutation.mutate(trimmed);
          }}
        >
          <p className="font-body text-sm text-on-card-muted">
            A code was texted to <strong className="text-on-card">{worker.phone}</strong>
            {expiresAt && timeZone ? <> — it expires at {formatTime(expiresAt, timeZone)}</> : null}.
          </p>
          <Field label="Verification code" htmlFor={codeId}>
            <Input
              id={codeId}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={12}
              autoFocus
              value={code}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => {
                setCode(event.target.value);
                if (error) setError(null);
              }}
              placeholder="6-digit code"
            />
          </Field>
          {notice ? <p className="text-sm text-on-card-muted">{notice}</p> : null}
          {error ? (
            <p id={errorId} role="alert" className="text-sm text-cadence-red">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => sendMutation.mutate()}
              disabled={busy}
            >
              {sendMutation.isPending ? "Sending…" : "Resend code"}
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="secondary" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {confirmMutation.isPending ? "Confirming…" : "Confirm"}
              </Button>
            </div>
          </div>
        </form>
      )}
    </Dialog>
  );
}
