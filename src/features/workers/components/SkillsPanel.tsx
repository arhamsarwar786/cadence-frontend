"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { addWorkerSkill, removeWorkerSkill } from "@/features/workers/actions";
import { listSkillsCatalog, listWorkerSkills } from "@/features/workers/api";
import { skillLinkSchema, type SkillLinkFormValues } from "@/features/workers/schemas";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import { Button, Dialog, Field, Input, Select } from "@/shared/ui";

const FIELD_NAMES = Object.keys(skillLinkSchema.shape);

export function SkillsPanel({ workerId }: { workerId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["workers", workerId, "skills"] as const;
  const query = useQuery({ queryKey, queryFn: () => listWorkerSkills(workerId) });
  const catalogQuery = useQuery({ queryKey: ["skills-catalog"], queryFn: listSkillsCatalog });
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SkillLinkFormValues>({ resolver: zodResolver(skillLinkSchema) });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey });
  }

  async function submit(values: SkillLinkFormValues) {
    setFormError(null);
    try {
      await addWorkerSkill(workerId, { ...values, years_exp: values.years_exp || undefined });
      await invalidate();
      reset();
      setOpen(false);
    } catch (error) {
      const matched = applyFieldErrors(setError, error, FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
    }
  }

  async function handleRemove(skillId: string) {
    await removeWorkerSkill(workerId, skillId);
    await invalidate();
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-subheading text-xl text-cadence-ink">Skills</h2>
        <Button size="sm" onClick={() => setOpen(true)}>
          Add skill
        </Button>
      </div>

      {query.isLoading ? (
        <p className="font-body text-sm text-cadence-ink/60">Loading…</p>
      ) : query.data && query.data.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {query.data.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-2 rounded-full border border-border bg-surface-muted px-3 py-1 font-body text-sm text-cadence-ink"
            >
              {row.skill_name}
              {row.years_exp != null ? (
                <span className="text-cadence-ink/60">{row.years_exp}y</span>
              ) : null}
              <button
                type="button"
                onClick={() => handleRemove(row.id)}
                className="text-cadence-ink/50 hover:text-cadence-red"
                aria-label={`Remove ${row.skill_name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-sm text-cadence-ink/60">No skills on file.</p>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Add skill">
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <Field label="Skill" htmlFor="skill-id" error={errors.skill_id?.message}>
            <Select id="skill-id" {...register("skill_id")}>
              <option value="">Select…</option>
              {catalogQuery.data?.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Years of experience"
            htmlFor="skill-years"
            error={errors.years_exp?.message}
            hint="e.g. 2.5"
          >
            <Input id="skill-years" {...register("years_exp")} />
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
