"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  createWorkerCert,
  deleteWorkerCert,
  verifyWorkerCert,
} from "@/features/workers/actions";
import { listWorkerCerts } from "@/features/workers/api";
import { certSchema, type CertFormValues } from "@/features/workers/schemas";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import { Button, Dialog, Field, Input, useConfirm } from "@/shared/ui";

const FIELD_NAMES = Object.keys(certSchema.shape);

export function CertsPanel({ workerId }: { workerId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["workers", workerId, "certs"] as const;
  const query = useQuery({ queryKey, queryFn: () => listWorkerCerts(workerId) });
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CertFormValues>({ resolver: zodResolver(certSchema) });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey });
  }

  async function submit(values: CertFormValues) {
    setFormError(null);
    try {
      await createWorkerCert(workerId, {
        name: values.name,
        issued: values.issued || undefined,
        expiry: values.expiry || undefined,
      });
      await invalidate();
      reset();
      setOpen(false);
    } catch (error) {
      const matched = applyFieldErrors(setError, error, FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
    }
  }

  async function handleDelete(certId: string) {
    const ok = await confirm({
      title: "Remove this certification?",
      body: "This record will be deleted from the worker profile.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    await deleteWorkerCert(workerId, certId);
    await invalidate();
  }

  async function handleVerify(certId: string) {
    await verifyWorkerCert(workerId, certId);
    await invalidate();
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-subheading text-xl text-cadence-ink">Certifications</h2>
        <Button size="sm" onClick={() => setOpen(true)}>
          Add certification
        </Button>
      </div>

      {query.isLoading ? (
        <p className="font-body text-sm text-cadence-ink/60">Loading…</p>
      ) : query.data && query.data.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {query.data.map((cert) => (
            <li key={cert.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-body text-sm font-medium text-cadence-ink">
                  {cert.name}
                  {cert.is_verified ? (
                    <span className="ml-2 text-xs text-emerald-700">Verified</span>
                  ) : null}
                </p>
                <p className="font-body text-xs text-cadence-ink/60">
                  {[cert.issued ? `Issued ${cert.issued}` : null, cert.expiry ? `Expires ${cert.expiry}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex gap-2">
                {!cert.is_verified ? (
                  <Button size="sm" variant="secondary" onClick={() => handleVerify(cert.id)}>
                    Verify
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => handleDelete(cert.id)}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-sm text-cadence-ink/60">No certifications on file.</p>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Add certification">
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
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>
      {confirmDialog}
    </section>
  );
}
