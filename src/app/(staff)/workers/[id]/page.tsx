"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notFound, useParams } from "next/navigation";
import { useState } from "react";
import { updateWorker } from "@/features/workers/actions";
import {
  getWorker,
  listWorkerAvailability,
  listWorkerCerts,
  listWorkerDocuments,
  listWorkerEducation,
  listWorkerSkills,
  workerKeys,
} from "@/features/workers/api";
import { AvailabilityPanel } from "@/features/workers/components/AvailabilityPanel";
import { BackgroundCheckPanel } from "@/features/workers/components/BackgroundCheckPanel";
import { CertsPanel } from "@/features/workers/components/CertsPanel";
import { ConsentPanel } from "@/features/workers/components/ConsentPanel";
import { EducationPanel } from "@/features/workers/components/EducationPanel";
import { EmploymentHistoryPanel } from "@/features/workers/components/EmploymentHistoryPanel";
import { IncidentsPanel } from "@/features/workers/components/IncidentsPanel";
import { LifecycleStatusBadge } from "@/features/workers/components/LifecycleStatusBadge";
import { SkillsPanel } from "@/features/workers/components/SkillsPanel";
import { TimeOffPanel } from "@/features/workers/components/TimeOffPanel";
import { WorkerDocumentsPanel } from "@/features/workers/components/WorkerDocumentsPanel";
import { WorkerLifecycleActions } from "@/features/workers/components/WorkerLifecycleActions";
import { WorkerPersonalPanel } from "@/features/workers/components/WorkerPersonalPanel";
import { WorkerProfileForm } from "@/features/workers/components/WorkerProfileForm";
import type { WorkerProfileFormValues } from "@/features/workers/schemas";
import type { EmployeeWrite } from "@/features/workers/types";
import { listShifts as listJobShifts, shiftKeys } from "@/features/jobs/api";
import { documentDownloadUrl } from "@/features/documents/api";
import { LogFollowUpButton } from "@/features/tasks/components/LogFollowUpDialog";
import { isNotFound, messageFrom } from "@/shared/lib/errors";
import type { LifecycleStatus } from "@/shared/lib/status-labels";
import { Button, Chip, EmptyState, PDFViewer, Tabs } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";

type MainTab = "resume" | "history" | "personal" | "more";
type MoreTab =
  | "profile"
  | "background"
  | "timeoff"
  | "employment"
  | "documents"
  | "incidents"
  | "consent"
  | "skills"
  | "certs"
  | "education"
  | "availability";

export default function WorkerDetailPage() {
  const { id: workerId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<MainTab>("resume");
  const [moreTab, setMoreTab] = useState<MoreTab>("profile");
  const [editingProfile, setEditingProfile] = useState(false);

  const query = useQuery({
    queryKey: workerKeys.detail(workerId),
    queryFn: () => getWorker(workerId),
    retry: false,
  });
  const skillsQuery = useQuery({
    queryKey: ["worker-skills", workerId],
    queryFn: () => listWorkerSkills(workerId),
  });
  const certsQuery = useQuery({
    queryKey: ["worker-certs", workerId],
    queryFn: () => listWorkerCerts(workerId),
  });
  const educationQuery = useQuery({
    queryKey: ["worker-education", workerId],
    queryFn: () => listWorkerEducation(workerId),
  });
  const availabilityQuery = useQuery({
    queryKey: ["worker-availability", workerId],
    queryFn: () => listWorkerAvailability(workerId),
  });
  const historyQuery = useQuery({
    queryKey: shiftKeys.list({ employee: workerId }),
    queryFn: () => listJobShifts({ employee: workerId, pageSize: 50 }),
    enabled: tab === "history",
  });
  const docsQuery = useQuery({
    queryKey: ["workers", workerId, "documents"],
    queryFn: () => listWorkerDocuments(workerId),
    enabled: tab === "resume",
  });

  if (query.isError && isNotFound(query.error)) notFound();

  function refetch() {
    return queryClient.invalidateQueries({ queryKey: workerKeys.detail(workerId) });
  }

  async function handleUpdateProfile(values: WorkerProfileFormValues) {
    await updateWorker(workerId, {
      first_name: values.first_name,
      last_name: values.last_name,
      email: values.email || undefined,
      phone: values.phone || undefined,
      pronouns: values.pronouns || undefined,
      address_line_1: values.address_line_1 || undefined,
      address_line_2: values.address_line_2 || undefined,
      city: values.city || undefined,
      province: values.province || undefined,
      postal_code: values.postal_code || undefined,
      emergency_contact_name: values.emergency_contact_name || undefined,
      emergency_contact_phone: values.emergency_contact_phone || undefined,
      employment_type: values.employment_type || undefined,
      work_authorization: values.work_authorization || undefined,
      work_status: values.work_status || undefined,
      pay_method: values.pay_method || undefined,
      notification_channel: values.notification_channel,
      referral_source: values.referral_source || undefined,
    } as Partial<EmployeeWrite>);
    await refetch();
    setEditingProfile(false);
  }

  if (query.isLoading) return <p className="font-body text-sm text-cadence-ink/60">Loading…</p>;
  if (query.isError) {
    return <p className="font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>;
  }
  const worker = query.data;
  if (!worker) return null;

  const topSkill = skillsQuery.data?.[0];
  const roleLabel = topSkill
    ? `${topSkill.skill_name}${topSkill.years_exp != null ? ` · ${topSkill.years_exp}y` : ""}`
    : worker.work_status?.replaceAll("_", " ") || "—";
  const resumeDoc =
    docsQuery.data?.find((d) => d.document_type === "resume") ?? docsQuery.data?.[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl text-cadence-ink sm:text-5xl">
            {worker.first_name} {worker.last_name}
            {worker.pronouns ? (
              <span className="ml-2 font-body text-lg text-cadence-ink/60">| {worker.pronouns}</span>
            ) : null}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <LifecycleStatusBadge status={worker.lifecycle_status as LifecycleStatus} />
            {"work_status" in worker && worker.work_status ? (
              <Chip tone="yellow">{String(worker.work_status).replaceAll("_", " ")}</Chip>
            ) : null}
            {"rating" in worker && worker.rating != null ? (
              <button
                type="button"
                className="font-body text-sm text-cadence-ink/70"
                onClick={() => {
                  setTab("more");
                  setMoreTab("incidents");
                }}
              >
                {"★".repeat(Math.max(0, Math.min(5, Math.round(Number(worker.rating) || 0))))}
                <span className="ml-1 text-cadence-ink/60">
                  {Number(worker.rating).toFixed(1)}
                </span>
              </button>
            ) : null}
            <span className="font-body text-sm text-cadence-ink/50">{roleLabel}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LogFollowUpButton
            entityType="employee"
            entityId={worker.id}
            entityLabel={`${worker.first_name} ${worker.last_name}`}
          />
          <WorkerLifecycleActions worker={worker} onChanged={refetch} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="rounded-[1.5rem] bg-surface p-4">
          <p className="mb-2 font-fine text-[10px] uppercase tracking-wide text-cadence-ink/60">
            Skills
          </p>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {(skillsQuery.data ?? []).slice(0, 8).map((s) => (
              <Chip key={s.id} tone="muted">
                {s.skill_name}
                {s.years_exp != null ? ` ${s.years_exp}y` : ""}
              </Chip>
            ))}
          </div>
          <dl className="space-y-3 font-body text-sm">
            <div>
              <dt className="text-cadence-ink/60">Email</dt>
              <dd>{worker.email || "—"}</dd>
            </div>
            <div>
              <dt className="text-cadence-ink/60">Phone</dt>
              <dd>{worker.phone || "—"}</dd>
            </div>
            <div>
              <dt className="text-cadence-ink/60">Joined</dt>
              <dd>{worker.join_date || "—"}</dd>
            </div>
            <div>
              <dt className="text-cadence-ink/60">Education</dt>
              <dd>
                {(educationQuery.data ?? [])
                  .slice(0, 2)
                  .map((e) => e.credential || e.institution)
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-cadence-ink/60">Licences / certs</dt>
              <dd>
                {(certsQuery.data ?? [])
                  .slice(0, 3)
                  .map((c) => c.name)
                  .join(", ") || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-cadence-ink/60">Availability</dt>
              <dd>
                {(availabilityQuery.data ?? [])
                  .slice(0, 3)
                  .map((a) => `D${a.day_of_week} ${a.start_time}–${a.end_time}`)
                  .join(" · ") || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-cadence-ink/60">Address</dt>
              <dd>
                {[worker.address_line_1, worker.city, worker.province, worker.postal_code]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </dd>
            </div>
          </dl>
          <Button
            size="sm"
            variant="secondary"
            className="mt-4"
            onClick={() => {
              setTab("more");
              setMoreTab("skills");
            }}
          >
            Edit summaries
          </Button>
        </aside>

        <section className="rounded-[1.5rem] bg-surface/70 p-5 shadow-card">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: "resume", label: "Resume" },
              { id: "history", label: "History" },
              { id: "personal", label: "Personal" },
              { id: "more", label: "More" },
            ]}
          />

          <div className="mt-5">
            {tab === "resume" ? (
              <div className="flex flex-col gap-4">
                {docsQuery.isLoading ? (
                  <p className="text-sm text-cadence-ink/60">Loading résumé…</p>
                ) : resumeDoc ? (
                  <PDFViewer
                    src={documentDownloadUrl(resumeDoc.document_id)}
                    title={resumeDoc.original_filename || "Resume.pdf"}
                  />
                ) : (
                  <EmptyState
                    title="No résumé on file"
                    description="Upload a résumé under More → Documents."
                  />
                )}
              </div>
            ) : null}

            {tab === "history" ? (
              historyQuery.isLoading ? (
                <p className="text-sm text-cadence-ink/60">Loading…</p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {(historyQuery.data?.results ?? []).map((s) => (
                    <li key={s.id} className="flex justify-between px-4 py-3 text-sm">
                      <span>
                        {s.shift_date} · {s.job_title}
                      </span>
                      <span className="text-cadence-ink/55">
                        {s.start_time}–{s.end_time}
                      </span>
                    </li>
                  ))}
                  {(historyQuery.data?.results ?? []).length === 0 ? (
                    <li className="px-4 py-6 text-center text-sm text-cadence-ink/50">
                      No shifts for this worker yet.
                    </li>
                  ) : null}
                </ul>
              )
            ) : null}

            {tab === "personal" ? (
              <WorkerPersonalPanel worker={worker} onRefetch={refetch} />
            ) : null}

            {tab === "more" ? (
              <div>
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {(
                    [
                      ["profile", "Profile"],
                      ["skills", "Skills"],
                      ["certs", "Certs"],
                      ["availability", "Availability"],
                      ["education", "Education"],
                      ["background", "Background check"],
                      ["timeoff", "Time off"],
                      ["employment", "Employment history"],
                      ["documents", "Documents"],
                      ["incidents", "Incidents"],
                      ["consent", "Consent"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setMoreTab(id)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs",
                        moreTab === id
                          ? "bg-cadence-yellow text-cadence-ink"
                          : "bg-cadence-ink/5 text-cadence-ink/55",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {moreTab === "profile" ? (
                  editingProfile ? (
                    <WorkerProfileForm
                      defaultValues={{
                        first_name: worker.first_name,
                        last_name: worker.last_name,
                        email: worker.email ?? "",
                        phone: worker.phone ?? "",
                        pronouns: worker.pronouns ?? "",
                        address_line_1: worker.address_line_1 ?? "",
                        address_line_2: worker.address_line_2 ?? "",
                        city: worker.city ?? "",
                        province: (worker.province as WorkerProfileFormValues["province"]) ?? "",
                        postal_code: worker.postal_code ?? "",
                        emergency_contact_name: worker.emergency_contact_name ?? "",
                        emergency_contact_phone: worker.emergency_contact_phone ?? "",
                        employment_type:
                          (worker.employment_type as WorkerProfileFormValues["employment_type"]) ??
                          "",
                        work_authorization:
                          (worker.work_authorization as WorkerProfileFormValues["work_authorization"]) ??
                          "",
                        work_status:
                          (worker.work_status as WorkerProfileFormValues["work_status"]) ?? "",
                        pay_method:
                          (worker.pay_method as WorkerProfileFormValues["pay_method"]) ?? "",
                        notification_channel: worker.notification_channel,
                        referral_source: worker.referral_source ?? "",
                      }}
                      onSubmit={handleUpdateProfile}
                      submitLabel="Save changes"
                    />
                  ) : (
                    <Button size="sm" onClick={() => setEditingProfile(true)}>
                      Edit profile
                    </Button>
                  )
                ) : null}
                {moreTab === "skills" ? <SkillsPanel workerId={workerId} /> : null}
                {moreTab === "certs" ? <CertsPanel workerId={workerId} /> : null}
                {moreTab === "availability" ? <AvailabilityPanel workerId={workerId} /> : null}
                {moreTab === "education" ? <EducationPanel workerId={workerId} /> : null}
                {moreTab === "background" ? (
                  <BackgroundCheckPanel worker={worker} onRefetch={refetch} />
                ) : null}
                {moreTab === "timeoff" ? <TimeOffPanel workerId={workerId} /> : null}
                {moreTab === "employment" ? (
                  <EmploymentHistoryPanel workerId={workerId} />
                ) : null}
                {moreTab === "documents" ? <WorkerDocumentsPanel workerId={workerId} /> : null}
                {moreTab === "incidents" ? <IncidentsPanel workerId={workerId} /> : null}
                {moreTab === "consent" ? <ConsentPanel worker={worker} /> : null}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
