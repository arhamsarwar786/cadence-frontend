"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { attachGovIdDocument, setPersonal, uploadDocument } from "@/features/workers/actions";
import { getGovIdDocumentIds, getPersonalField } from "@/features/workers/api";
import { personalSchema, type PersonalFormValues } from "@/features/workers/schemas";
import type { Employee } from "@/features/workers/types";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import { Button, Field, Input } from "@/shared/ui";

const PII_FIELDS = [
  { key: "sin", label: "SIN", masked: (e: Employee) => e.sin_last4 },
  { key: "dob", label: "Date of birth", masked: (e: Employee) => e.dob_year },
  {
    key: "bank_account",
    label: "Bank account",
    masked: (e: Employee) => e.bank_account_last4,
  },
] as const;

/** A revealed value lives only in this component's own state — never
 * TanStack Query's cache, never localStorage, never the URL
 * (ARCHITECTURE.md §9). It clears itself on navigation away for free
 * because the component unmounts. */
function RevealField({ workerId, field }: { workerId: string; field: string }) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function reveal() {
    setLoading(true);
    setError(null);
    try {
      const result = await getPersonalField(workerId, field);
      setRevealed(result.value);
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2 font-body text-sm">
      {revealed ? (
        <>
          <span className="font-medium text-cadence-ink">{revealed}</span>
          <Button size="sm" variant="ghost" onClick={() => setRevealed(null)}>
            Hide
          </Button>
        </>
      ) : (
        <Button size="sm" variant="secondary" disabled={loading} onClick={reveal}>
          {loading ? "Revealing…" : "Reveal"}
        </Button>
      )}
      {error ? <span className="text-xs text-cadence-red">{error}</span> : null}
    </div>
  );
}

function PersonalEditForm({
  workerId,
  onDone,
}: {
  workerId: string;
  onDone: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PersonalFormValues>({ resolver: zodResolver(personalSchema) });

  async function submit(values: PersonalFormValues) {
    setFormError(null);
    // Only fields actually typed are sent — each gates independently
    // server-side, and a blank isn't "clear this," it's "leave alone."
    const payload = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v !== "" && v !== undefined),
    );
    if (Object.keys(payload).length === 0) {
      onDone();
      return;
    }
    try {
      await setPersonal(workerId, payload);
      onDone();
    } catch (error) {
      const formMessage = applyFieldErrors(setError, error, Object.keys(personalSchema.shape));
      if (formMessage) setFormError(formMessage);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="flex max-w-sm flex-col gap-3">
      <Field label="SIN" htmlFor="sin" error={errors.sin?.message} hint="Leave blank to keep unchanged.">
        <Input id="sin" {...register("sin")} />
      </Field>
      <Field label="Date of birth" htmlFor="dob" error={errors.dob?.message} hint="YYYY-MM-DD">
        <Input id="dob" type="date" {...register("dob")} />
      </Field>
      <Field label="Bank transit #" htmlFor="bank_transit" error={errors.bank_transit?.message}>
        <Input id="bank_transit" {...register("bank_transit")} />
      </Field>
      <Field label="Bank account #" htmlFor="bank_account" error={errors.bank_account?.message}>
        <Input id="bank_account" {...register("bank_account")} />
      </Field>
      {formError ? <p className="font-body text-sm text-cadence-red">{formError}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function GovIdPanel({ workerId }: { workerId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["workers", workerId, "gov-id"] as const;
  const query = useQuery({ queryKey, queryFn: () => getGovIdDocumentIds(workerId) });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const doc = await uploadDocument(file, "gov_id");
      await attachGovIdDocument(workerId, doc.id);
      await queryClient.invalidateQueries({ queryKey });
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 font-body text-sm">
      <p className="text-cadence-ink/60">
        {query.data ? `${query.data.gov_id_document_ids.length} ID scan(s) on file` : "Loading…"}
      </p>
      <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-cadence-ink hover:bg-surface-muted">
        {uploading ? "Uploading…" : "Upload a scan"}
        <input
          type="file"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
      </label>
      {error ? <p className="text-xs text-cadence-red">{error}</p> : null}
    </div>
  );
}

export function WorkerPersonalPanel({ worker, onRefetch }: { worker: Employee; onRefetch: () => void }) {
  const [editing, setEditing] = useState(false);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-subheading text-xl text-cadence-ink">Personal / PII</h2>
        {!editing ? (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
        ) : null}
      </div>

      {editing ? (
        <PersonalEditForm
          workerId={worker.id}
          onDone={() => {
            setEditing(false);
            onRefetch();
          }}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {PII_FIELDS.map(({ key, label, masked }) => {
            const maskedValue = masked(worker);
            if (maskedValue === undefined) return null;
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="w-32 font-body text-sm text-cadence-ink/60">{label}</span>
                <span className="font-body text-sm text-cadence-ink">
                  {maskedValue === null ? "Not on file" : String(maskedValue)}
                </span>
                {maskedValue !== null ? <RevealField workerId={worker.id} field={key} /> : null}
              </div>
            );
          })}
        </div>
      )}

      <div>
        <h3 className="mb-2 font-body text-sm font-medium text-cadence-ink">Government ID</h3>
        <GovIdPanel workerId={worker.id} />
      </div>
    </section>
  );
}
