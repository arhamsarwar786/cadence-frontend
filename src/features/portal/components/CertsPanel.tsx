"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { addCert, deleteCert } from "@/features/portal/actions";
import { listCerts } from "@/features/portal/api";
import { portalCertSchema, type PortalCertFormValues } from "@/features/portal/schemas";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import { Button, Dialog, Field, Input } from "@/shared/ui";

const FIELD_NAMES = Object.keys(portalCertSchema.shape);
const QUERY_KEY = ["portal", "certs"] as const;

export function CertsPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: listCerts });
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
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

  async function submit(values: PortalCertFormValues) {
    setFormError(null);
    try {
      await addCert({ name: values.name, issued: values.issued || undefined, expiry: values.expiry || undefined });
      await invalidate();
      reset();
      setOpen(false);
    } catch (error) {
      const matched = applyFieldErrors(setError, error, FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Remove this certification?")) return;
    await deleteCert(id);
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
      {query.data && query.data.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {query.data.map((cert) => (
            <li key={cert.id} className="flex items-center justify-between px-4 py-3">
              <p className="font-body text-sm text-cadence-ink">
                {cert.name}
                {cert.is_verified ? <span className="ml-2 text-xs text-emerald-700">Verified</span> : null}
              </p>
              <Button size="sm" variant="ghost" onClick={() => handleDelete(cert.id)}>
                Remove
              </Button>
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
    </section>
  );
}
