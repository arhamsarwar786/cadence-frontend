"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { addRequirement, deleteRequirement } from "@/features/jobs/actions";
import { listJobRequirements } from "@/features/jobs/api";
import { requirementSchema, type RequirementFormValues } from "@/features/jobs/schemas";
import { listSkillsCatalog } from "@/features/workers/api";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import { Button, Dialog, Field, Input, Select, useConfirm } from "@/shared/ui";

const FIELD_NAMES = Object.keys(requirementSchema.shape);

export function RequirementsPanel({ jobId }: { jobId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["jobs", jobId, "requirements"] as const;
  const query = useQuery({ queryKey, queryFn: () => listJobRequirements(jobId) });
  const { confirm, dialog: confirmDialog } = useConfirm();
  const skillsQuery = useQuery({ queryKey: ["skills-catalog"], queryFn: listSkillsCatalog });
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RequirementFormValues>({
    resolver: zodResolver(requirementSchema) as Resolver<RequirementFormValues>,
  });
  const requirementType = watch("requirement_type");

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey });
  }

  async function submit(values: RequirementFormValues) {
    setFormError(null);
    try {
      await addRequirement(jobId, {
        requirement_type: values.requirement_type,
        skill_id: values.requirement_type === "skill" ? values.skill_id || undefined : undefined,
        cert_name: values.requirement_type === "cert" ? values.cert_name || "" : "",
        min_years: values.min_years || undefined,
      });
      await invalidate();
      reset();
      setOpen(false);
    } catch (error) {
      const matched = applyFieldErrors(setError, error, FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: "Remove this requirement?",
      body: "The requirement will be deleted from this job.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    await deleteRequirement(jobId, id);
    await invalidate();
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-subheading text-xl text-cadence-ink">Requirements</h2>
        <Button size="sm" onClick={() => setOpen(true)}>
          Add requirement
        </Button>
      </div>

      {query.isLoading ? (
        <p className="font-body text-sm text-cadence-ink/60">Loading…</p>
      ) : query.data && query.data.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {query.data.map((r) => (
            <li key={r.id} className="flex items-center justify-between px-4 py-3">
              <p className="font-body text-sm text-cadence-ink">
                {r.requirement_type === "skill" ? r.skill_name : r.cert_name}
                {r.min_years != null ? ` · ${r.min_years}y+` : ""}
              </p>
              <Button size="sm" variant="ghost" onClick={() => handleDelete(r.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-sm text-cadence-ink/60">No requirements set.</p>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Add requirement">
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <Field label="Type" htmlFor="req-type" error={errors.requirement_type?.message}>
            <Select id="req-type" {...register("requirement_type")}>
              <option value="skill">Skill</option>
              <option value="cert">Certification</option>
            </Select>
          </Field>
          {requirementType === "cert" ? (
            <Field label="Certification name" htmlFor="req-cert" error={errors.cert_name?.message}>
              <Input id="req-cert" {...register("cert_name")} />
            </Field>
          ) : (
            <Field label="Skill" htmlFor="req-skill" error={errors.skill_id?.message}>
              <Select id="req-skill" {...register("skill_id")}>
                <option value="">Select…</option>
                {skillsQuery.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Minimum years" htmlFor="req-years" error={errors.min_years?.message} hint="e.g. 2.5">
            <Input id="req-years" {...register("min_years")} />
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
