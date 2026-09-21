"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { addCert, deleteCert, updateCert } from "@/features/portal/actions";
import { listCerts } from "@/features/portal/api";
import { portalCertSchema, type PortalCertFormValues } from "@/features/portal/schemas";
import type { PortalCert } from "@/features/portal/types";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import { Button, Dialog, Field, Input, useConfirm } from "@/shared/ui";

const FIELD_NAMES = Object.keys(portalCertSchema.shape);
const QUERY_KEY = ["portal", "certs"] as const;

function expiryLabel(expiry: string | null | undefined) {
  return expiry ? `expires ${expiry}` : "no expiry";
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="inline h-3.5 w-3.5 shrink-0" aria-hidden fill="currentColor">
      <path d="M8 1a3 3 0 0 0-3 3v2H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1V4a3 3 0 0 0-3-3zm1 5V4a1 1 0 1 0-2 0v2h2z" />
    </svg>
  );
}

export function CertsPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: listCerts });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PortalCert | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PortalCertFormValues>({ resolver: zodResolver(portalCertSchema) });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }

  function openCreate() {
    setEditing(null);
    reset({ name: "", issued: "", expiry: "" });
    setFormError(null);
    setOpen(true);
  }

  function openEdit(cert: PortalCert) {
    if (cert.is_verified) return;
    setEditing(cert);
    reset({
      name: cert.name,
      issued: cert.issued ?? "",
      expiry: cert.expiry ?? "",
    });
    setFormError(null);
    setOpen(true);
  }

  async function submit(values: PortalCertFormValues) {
    setFormError(null);
    const body = {
      name: values.name,
      issued: values.issued || undefined,
      expiry: values.expiry || undefined,
    };
    try {
      if (editing) {
        await updateCert(editing.id, body);
      } else {
        await addCert(body);
      }
      await invalidate();
      reset();
      setEditing(null);
      setOpen(false);
    } catch (error) {
      const formMessage = applyFieldErrors(setError, error, FIELD_NAMES);
      if (formMessage) setFormError(formMessage);
      else setFormError(messageFrom(error));
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: "Remove this certification?",
      body: "This record will be deleted from your profile.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    await deleteCert(id);
    await invalidate();
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-subheading text-xl text-cadence-ink">Certifications</h2>
        <Button size="sm" onClick={openCreate}>
          Add certification
        </Button>
      </div>
      {query.data && query.data.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
          {query.data.map((cert) => (
            <li key={cert.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-body text-sm text-cadence-ink">
                  {cert.is_verified ? <LockIcon /> : null}
                  <span className="truncate">{cert.name}</span>
                </p>
                <p className="mt-0.5 font-body text-xs text-cadence-ink/60">
                  {cert.is_verified ? "Verified" : "Unverified"} · {expiryLabel(cert.expiry)}
                </p>
              </div>
              {cert.is_verified ? (
                <span className="shrink-0 font-body text-xs text-cadence-ink/55">Locked</span>
              ) : (
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(cert)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(cert.id)}>
                    Remove
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-sm text-cadence-ink/60">No certifications on file.</p>
      )}
      <p className="font-fine text-[11px] text-cadence-ink/55">
        A verified certification is locked once your office confirms it.
      </p>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        title={editing ? "Edit certification" : "Add certification"}
      >
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <Field label="Name" htmlFor="cert-name" error={errors.name?.message}>
            <Input id="cert-name" {...register("name")} />
          </Field>
          <Field label="Issued" htmlFor="cert-issued" error={errors.issued?.message}>
            <Input id="cert-issued" type="date" {...register("issued")} />
          </Field>
          <Field label="Expiry" htmlFor="cert-expiry" error={errors.expiry?.message}>
            <Input id="cert-expiry" type="date" {...register("expiry")} />
          </Field>
          {formError ? <p className="font-body text-sm text-cadence-red">{formError}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setOpen(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>
      {confirmDialog}
    </section>
  );
}
