"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import {
  addAvailability,
  addEducation,
  addEmploymentHistory,
  addSkill,
  addTimeOff,
  deleteAvailability,
  deleteEducation,
  deleteEmploymentHistory,
  deleteTimeOff,
  removeSkill,
} from "@/features/portal/actions";
import {
  listAvailability,
  listEducation,
  listEmploymentHistory,
  listSkillCatalog,
  listSkills,
  listTimeOff,
} from "@/features/portal/api";
import {
  portalAvailabilitySchema,
  portalEducationSchema,
  portalEmploymentHistorySchema,
  portalSkillLinkSchema,
  portalTimeOffSchema,
  type PortalAvailabilityFormValues,
  type PortalEducationFormValues,
  type PortalEmploymentHistoryFormValues,
  type PortalSkillLinkFormValues,
  type PortalTimeOffFormValues,
} from "@/features/portal/schemas";
import { DAYS_OF_WEEK } from "@/features/workers/schemas";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import { TIME_OFF_TYPE_LABELS } from "@/shared/lib/status-labels";
import { Button, Dialog, Field, Input, Select } from "@/shared/ui";

const DAY_LABEL = new Map<number, string>(DAYS_OF_WEEK.map((d) => [d.value, d.label]));

export function SkillsPanel() {
  const queryClient = useQueryClient();
  const queryKey = ["portal", "skills"] as const;
  const query = useQuery({ queryKey, queryFn: listSkills });
  const catalogQuery = useQuery({ queryKey: ["portal", "skill-catalog"], queryFn: listSkillCatalog });
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const FIELD_NAMES = Object.keys(portalSkillLinkSchema.shape);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PortalSkillLinkFormValues>({ resolver: zodResolver(portalSkillLinkSchema) });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey });
  }

  async function submit(values: PortalSkillLinkFormValues) {
    setFormError(null);
    try {
      await addSkill({ skill_id: values.skill_id, years_exp: values.years_exp || undefined });
      await invalidate();
      reset();
      setOpen(false);
    } catch (error) {
      const matched = applyFieldErrors(setError, error, FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-subheading text-xl text-cadence-ink">Skills</h2>
        <Button size="sm" onClick={() => setOpen(true)}>
          Add skill
        </Button>
      </div>
      {query.data && query.data.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {query.data.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-2 rounded-full border border-border bg-surface-muted px-3 py-1 font-body text-sm text-cadence-ink"
            >
              {row.skill_name}
              {row.years_exp != null ? <span className="text-cadence-ink/60">{row.years_exp}y</span> : null}
              <button
                type="button"
                onClick={() => removeSkill(row.id).then(invalidate)}
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
          <Field label="Skill" htmlFor="p-skill-id" error={errors.skill_id?.message}>
            <Select id="p-skill-id" {...register("skill_id")}>
              <option value="">Select…</option>
              {catalogQuery.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Years of experience" htmlFor="p-skill-years" error={errors.years_exp?.message} hint="e.g. 2.5">
            <Input id="p-skill-years" {...register("years_exp")} />
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

export function AvailabilityPanel() {
  const queryClient = useQueryClient();
  const queryKey = ["portal", "availability"] as const;
  const query = useQuery({ queryKey, queryFn: listAvailability });
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const FIELD_NAMES = Object.keys(portalAvailabilitySchema.shape);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PortalAvailabilityFormValues>({
    resolver: zodResolver(portalAvailabilitySchema) as Resolver<PortalAvailabilityFormValues>,
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey });
  }

  async function submit(values: PortalAvailabilityFormValues) {
    setFormError(null);
    try {
      await addAvailability(values as Parameters<typeof addAvailability>[0]);
      await invalidate();
      reset();
      setOpen(false);
    } catch (error) {
      const matched = applyFieldErrors(setError, error, FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Remove this availability window?")) return;
    await deleteAvailability(id);
    await invalidate();
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-subheading text-xl text-cadence-ink">Availability</h2>
        <Button size="sm" onClick={() => setOpen(true)}>
          Add window
        </Button>
      </div>
      {query.data && query.data.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {query.data.map((row) => (
            <li key={row.id} className="flex items-center justify-between px-4 py-3">
              <p className="font-body text-sm text-cadence-ink">
                {DAY_LABEL.get(row.day_of_week)} · {row.start_time}–{row.end_time}
              </p>
              <Button size="sm" variant="ghost" onClick={() => handleDelete(row.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-sm text-cadence-ink/60">No availability set.</p>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title="Add availability window">
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <Field label="Day" htmlFor="p-avail-day" error={errors.day_of_week?.message}>
            <Select id="p-avail-day" {...register("day_of_week")}>
              {DAYS_OF_WEEK.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Start time" htmlFor="p-avail-start" error={errors.start_time?.message}>
            <Input id="p-avail-start" type="time" {...register("start_time")} />
          </Field>
          <Field label="End time" htmlFor="p-avail-end" error={errors.end_time?.message}>
            <Input id="p-avail-end" type="time" {...register("end_time")} />
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

export function EducationPanel() {
  const queryClient = useQueryClient();
  const queryKey = ["portal", "education"] as const;
  const query = useQuery({ queryKey, queryFn: listEducation });
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const FIELD_NAMES = Object.keys(portalEducationSchema.shape);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PortalEducationFormValues>({
    resolver: zodResolver(portalEducationSchema) as Resolver<PortalEducationFormValues>,
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey });
  }

  async function submit(values: PortalEducationFormValues) {
    setFormError(null);
    try {
      await addEducation(values);
      await invalidate();
      reset();
      setOpen(false);
    } catch (error) {
      const matched = applyFieldErrors(setError, error, FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Remove this education entry?")) return;
    await deleteEducation(id);
    await invalidate();
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-subheading text-xl text-cadence-ink">Education</h2>
        <Button size="sm" onClick={() => setOpen(true)}>
          Add entry
        </Button>
      </div>
      {query.data && query.data.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {query.data.map((row) => (
            <li key={row.id} className="flex items-center justify-between px-4 py-3">
              <p className="font-body text-sm text-cadence-ink">
                {row.credential} — {row.institution}
              </p>
              <Button size="sm" variant="ghost" onClick={() => handleDelete(row.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-sm text-cadence-ink/60">No education on file.</p>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title="Add education">
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <Field label="Institution" htmlFor="p-edu-institution" error={errors.institution?.message}>
            <Input id="p-edu-institution" {...register("institution")} />
          </Field>
          <Field label="Credential" htmlFor="p-edu-credential" error={errors.credential?.message}>
            <Input id="p-edu-credential" {...register("credential")} />
          </Field>
          <Field label="Year" htmlFor="p-edu-year" error={errors.year?.message}>
            <Input id="p-edu-year" {...register("year")} />
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

export function EmploymentHistoryPanel() {
  const queryClient = useQueryClient();
  const queryKey = ["portal", "employment-history"] as const;
  const query = useQuery({ queryKey, queryFn: listEmploymentHistory });
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const FIELD_NAMES = Object.keys(portalEmploymentHistorySchema.shape);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PortalEmploymentHistoryFormValues>({ resolver: zodResolver(portalEmploymentHistorySchema) });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey });
  }

  async function submit(values: PortalEmploymentHistoryFormValues) {
    setFormError(null);
    try {
      await addEmploymentHistory({
        ...values,
        job_title: values.job_title || undefined,
        started_on: values.started_on || undefined,
        ended_on: values.ended_on || undefined,
        supervisor_name: values.supervisor_name || undefined,
        supervisor_phone: values.supervisor_phone || undefined,
        supervisor_email: values.supervisor_email || undefined,
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
    if (!window.confirm("Remove this entry?")) return;
    await deleteEmploymentHistory(id);
    await invalidate();
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-subheading text-xl text-cadence-ink">Employment history</h2>
        <Button size="sm" onClick={() => setOpen(true)}>
          Add entry
        </Button>
      </div>
      {query.data && query.data.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {query.data.map((row) => (
            <li key={row.id} className="flex items-center justify-between px-4 py-3">
              <p className="font-body text-sm text-cadence-ink">
                {row.job_title ? `${row.job_title} — ` : ""}
                {row.employer_name}
              </p>
              <Button size="sm" variant="ghost" onClick={() => handleDelete(row.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-sm text-cadence-ink/60">No employment history on file.</p>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title="Add employment history">
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <Field label="Employer" htmlFor="p-eh-employer" error={errors.employer_name?.message}>
            <Input id="p-eh-employer" {...register("employer_name")} />
          </Field>
          <Field label="Job title" htmlFor="p-eh-title" error={errors.job_title?.message}>
            <Input id="p-eh-title" {...register("job_title")} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Started" htmlFor="p-eh-started" error={errors.started_on?.message}>
              <Input id="p-eh-started" type="date" {...register("started_on")} />
            </Field>
            <Field label="Ended" htmlFor="p-eh-ended" error={errors.ended_on?.message}>
              <Input id="p-eh-ended" type="date" {...register("ended_on")} />
            </Field>
          </div>
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

export function TimeOffPanel() {
  const queryClient = useQueryClient();
  const queryKey = ["portal", "time-off"] as const;
  const query = useQuery({ queryKey, queryFn: listTimeOff });
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const FIELD_NAMES = Object.keys(portalTimeOffSchema.shape);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PortalTimeOffFormValues>({ resolver: zodResolver(portalTimeOffSchema) });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey });
  }

  async function submit(values: PortalTimeOffFormValues) {
    setFormError(null);
    try {
      await addTimeOff(values);
      await invalidate();
      reset();
      setOpen(false);
    } catch (error) {
      const matched = applyFieldErrors(setError, error, FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Remove this time-off entry?")) return;
    await deleteTimeOff(id);
    await invalidate();
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-subheading text-xl text-cadence-ink">Time off</h2>
        <Button size="sm" onClick={() => setOpen(true)}>
          Add entry
        </Button>
      </div>
      {query.data && query.data.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {query.data.map((row) => (
            <li key={row.id} className="flex items-center justify-between px-4 py-3">
              <p className="font-body text-sm text-cadence-ink">
                {TIME_OFF_TYPE_LABELS[row.type]} · {row.start_date} – {row.end_date}
              </p>
              <Button size="sm" variant="ghost" onClick={() => handleDelete(row.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-sm text-cadence-ink/60">No time off on file.</p>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title="Add time off">
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <Field label="Type" htmlFor="p-to-type" error={errors.type?.message}>
            <Select id="p-to-type" {...register("type")}>
              <option value="vacation">Vacation</option>
              <option value="sick">Sick</option>
              <option value="personal">Personal</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start date" htmlFor="p-to-start" error={errors.start_date?.message}>
              <Input id="p-to-start" type="date" {...register("start_date")} />
            </Field>
            <Field label="End date" htmlFor="p-to-end" error={errors.end_date?.message}>
              <Input id="p-to-end" type="date" {...register("end_date")} />
            </Field>
          </div>
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
