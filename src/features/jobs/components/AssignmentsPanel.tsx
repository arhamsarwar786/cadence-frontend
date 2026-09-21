"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { createAssignment } from "@/features/jobs/actions";
import { listJobAssignments } from "@/features/jobs/api";
import { AssignmentStatusBadge } from "@/features/jobs/components/StatusBadges";
import {
  listSkillsCatalog,
  listWorkerAvailability,
  listWorkerCerts,
  listWorkerEducation,
  listWorkerSkills,
  searchWorkers,
} from "@/features/workers/api";
import type { EmployeeList } from "@/features/workers/types";
import { PERM } from "@/permissions/keys";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import type { AssignmentStatus } from "@/shared/lib/status-labels";
import { formatMoney } from "@/shared/lib/money";
import { matchesQuery } from "@/shared/lib/matches";
import {
  Avatar,
  Button,
  Chip,
  Dialog,
  Field,
  Input,
  Pagination,
  PermGate,
  SearchField,
  Select,
  TableSkeleton,
} from "@/shared/ui";
import { z } from "zod";

const assignSchema = z.object({ employee_id: z.string().min(1, "Pick a worker.") });
type AssignFormValues = z.infer<typeof assignSchema>;
const FIELD_NAMES = Object.keys(assignSchema.shape);
const PAGE_SIZE = 20;

export function AssignmentsPanel({ jobId }: { jobId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["jobs", jobId, "assignments"] as const;
  const query = useQuery({ queryKey, queryFn: () => listJobAssignments(jobId) });

  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [skill, setSkill] = useState("");
  const [cert, setCert] = useState("");
  const [minYears, setMinYears] = useState("");
  const [availableOn, setAvailableOn] = useState("");
  const [availableAt, setAvailableAt] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const skillsCatalog = useQuery({
    queryKey: ["skills-catalog"],
    queryFn: listSkillsCatalog,
    enabled: open,
  });

  const searchParams = {
    page,
    pageSize: PAGE_SIZE,
    skill: skill || undefined,
    cert: cert || undefined,
    minYears: minYears ? Number(minYears) : undefined,
    availableOn: availableOn || undefined,
    availableAt: availableAt || undefined,
  };

  useEffect(() => {
    setPage(1);
  }, [skill, cert, minYears, availableOn, availableAt]);

  const workersQuery = useQuery({
    queryKey: ["workers-search", "assign", searchParams],
    queryFn: () => searchWorkers(searchParams),
    enabled: open,
  });

  const {
    handleSubmit,
    setError,
    setValue,
    reset,
    formState: { isSubmitting },
  } = useForm<AssignFormValues>({ resolver: zodResolver(assignSchema) });

  const rows = useMemo(() => {
    const results = workersQuery.data?.results ?? [];
    if (!q.trim()) return results;
    return results.filter((w) =>
      matchesQuery(`${w.first_name} ${w.last_name} ${w.email ?? ""} ${w.phone ?? ""}`, q),
    );
  }, [q, workersQuery.data?.results]);

  const showRating = rows.some((w) => "rating" in w);

  const profileQueries = useQueries({
    queries: rows.slice(0, PAGE_SIZE).map((w) => ({
      queryKey: ["assign-profile", w.id],
      queryFn: async () => {
        const [skills, certs, education, availability] = await Promise.all([
          listWorkerSkills(w.id),
          listWorkerCerts(w.id),
          listWorkerEducation(w.id),
          listWorkerAvailability(w.id),
        ]);
        return { skills, certs, education, availability };
      },
      enabled: open && rows.length > 0,
      staleTime: 60_000,
    })),
  });

  const profiles = useMemo(() => {
    const map = new Map<
      string,
      {
        skills: Awaited<ReturnType<typeof listWorkerSkills>>;
        certs: Awaited<ReturnType<typeof listWorkerCerts>>;
        education: Awaited<ReturnType<typeof listWorkerEducation>>;
        availability: Awaited<ReturnType<typeof listWorkerAvailability>>;
      }
    >();
    rows.slice(0, PAGE_SIZE).forEach((w, i) => {
      const data = profileQueries[i]?.data;
      if (data) map.set(w.id, data);
    });
    return map;
  }, [profileQueries, rows]);

  async function submit(values: AssignFormValues) {
    setFormError(null);
    try {
      await createAssignment(jobId, values);
      await queryClient.invalidateQueries({ queryKey });
      reset();
      setSelected(null);
      setOpen(false);
    } catch (error) {
      const banner = applyFieldErrors(setError, error, FIELD_NAMES);
      if (banner) setFormError(banner);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-subheading text-xl text-cadence-ink">Assignments</h2>
        <PermGate anyOf={PERM.JOBS_ASSIGN}>
          <Button size="sm" onClick={() => setOpen(true)}>
            Assign worker
          </Button>
        </PermGate>
      </div>

      {query.isLoading ? (
        <p className="font-body text-sm text-cadence-ink/60">Loading…</p>
      ) : query.data && query.data.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {query.data.map((a) => (
            <li key={a.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <Link
                  href={`/assignments/${a.id}`}
                  className="font-body text-sm font-medium text-cadence-ink hover:underline"
                >
                  {a.employee_name}
                </Link>
                <p className="font-body text-xs text-cadence-ink/60">
                  {"pay_rate" in a ? `Pay ${formatMoney(a.pay_rate)}` : ""}
                </p>
              </div>
              <AssignmentStatusBadge status={a.status as AssignmentStatus} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-sm text-cadence-ink/60">No one assigned yet.</p>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Assign job">
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[12rem] flex-1">
              <SearchField value={q} onChange={setQ} placeholder="Search candidates" label="Search" />
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={() => setFiltersOpen((v) => !v)}>
              {filtersOpen ? "Hide filters" : "Filter"}
            </Button>
          </div>

          {filtersOpen ? (
            <div className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-2">
              <Field label="Skill" htmlFor="af-skill">
                <Select id="af-skill" value={skill} onChange={(e) => setSkill(e.target.value)}>
                  <option value="">Any</option>
                  {(skillsCatalog.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Min years (with skill)" htmlFor="af-years">
                <Input
                  id="af-years"
                  type="number"
                  min={0}
                  value={minYears}
                  onChange={(e) => setMinYears(e.target.value)}
                />
              </Field>
              <Field label="Certification name" htmlFor="af-cert">
                <Input id="af-cert" value={cert} onChange={(e) => setCert(e.target.value)} placeholder="e.g. Forklift" />
              </Field>
              <Field label="Available on" htmlFor="af-on">
                <Input id="af-on" type="date" value={availableOn} onChange={(e) => setAvailableOn(e.target.value)} />
              </Field>
              <Field label="Available at" htmlFor="af-at">
                <Input id="af-at" type="time" value={availableAt} onChange={(e) => setAvailableAt(e.target.value)} />
              </Field>
            </div>
          ) : null}

          {workersQuery.isLoading ? (
            <TableSkeleton rows={6} columns={showRating ? 6 : 5} />
          ) : (
            <>
              <div className="max-h-[28rem] overflow-auto rounded-xl border border-border bg-surface text-cadence-ink">
                <table className="w-full min-w-[48rem] text-left text-sm">
                  <thead className="sticky top-0 bg-surface font-fine text-[10px] uppercase tracking-wide text-cadence-ink/60">
                    <tr>
                      <th className="px-3 py-2">Candidate</th>
                      <th className="px-3 py-2">Experience</th>
                      <th className="px-3 py-2">Certs</th>
                      <th className="px-3 py-2">Education</th>
                      <th className="px-3 py-2">Availability</th>
                      {showRating ? <th className="px-3 py-2">Rating</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((w) => (
                      <WorkerPickRow
                        key={w.id}
                        worker={w}
                        profile={profiles.get(w.id)}
                        showRating={showRating}
                        selected={selected === w.id}
                        onSelect={() => {
                          setSelected(w.id);
                          setValue("employee_id", w.id, { shouldValidate: true });
                        }}
                      />
                    ))}
                  </tbody>
                </table>
                {rows.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-cadence-ink/60">No candidates match.</p>
                ) : null}
              </div>
              {workersQuery.data ? (
                <Pagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  count={workersQuery.data.count}
                  onPageChange={setPage}
                />
              ) : null}
            </>
          )}
          {formError ? <p className="font-body text-sm text-cadence-red">{formError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !selected}>
              {isSubmitting ? "Assigning…" : "Assign job"}
            </Button>
          </div>
        </form>
      </Dialog>
    </section>
  );
}

function WorkerPickRow({
  worker: w,
  profile,
  showRating,
  selected,
  onSelect,
}: {
  worker: EmployeeList;
  profile?: {
    skills: Awaited<ReturnType<typeof listWorkerSkills>>;
    certs: Awaited<ReturnType<typeof listWorkerCerts>>;
    education: Awaited<ReturnType<typeof listWorkerEducation>>;
    availability: Awaited<ReturnType<typeof listWorkerAvailability>>;
  };
  showRating: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const name = `${w.first_name} ${w.last_name}`;
  const workStatus = "work_status" in w ? String(w.work_status ?? "") : "";
  return (
    <tr
      className={`cursor-pointer border-t border-border ${selected ? "bg-cadence-yellow/30" : "hover:bg-surface"}`}
      onClick={onSelect}
    >
      <td className="px-3 py-2 align-top">
        <span className="flex items-center gap-2">
          <Avatar name={name} size="sm" />
          <span>
            <span className="block font-medium">{name}</span>
            {workStatus ? (
              <Chip tone="muted" className="mt-1">
                {workStatus.replaceAll("_", " ")}
              </Chip>
            ) : null}
          </span>
        </span>
      </td>
      <td className="px-3 py-2 align-top">
        <ChipStack
          items={(profile?.skills ?? []).slice(0, 4).map((s) =>
            s.years_exp != null ? `${s.skill_name} ${s.years_exp}y` : s.skill_name,
          )}
        />
      </td>
      <td className="px-3 py-2 align-top">
        <ChipStack items={(profile?.certs ?? []).slice(0, 4).map((c) => c.name)} />
      </td>
      <td className="px-3 py-2 align-top">
        <ChipStack
          items={(profile?.education ?? [])
            .slice(0, 3)
            .map((e) => e.credential || e.institution)
            .filter(Boolean) as string[]}
        />
      </td>
      <td className="px-3 py-2 align-top text-xs text-cadence-ink/60">
        {(profile?.availability ?? []).slice(0, 2).map((a) => (
          <div key={a.id}>
            D{a.day_of_week} {a.start_time}–{a.end_time}
          </div>
        ))}
        {!profile ? "…" : (profile.availability?.length ?? 0) === 0 ? "—" : null}
      </td>
      {showRating ? (
        <td className="px-3 py-2 align-top">
          {"rating" in w && w.rating != null ? `★ ${w.rating}` : "—"}
        </td>
      ) : null}
    </tr>
  );
}

function ChipStack({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-cadence-ink/55">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <Chip key={item} tone="muted">
          {item}
        </Chip>
      ))}
    </div>
  );
}
