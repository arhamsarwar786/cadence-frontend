"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notFound, useParams } from "next/navigation";
import { useState } from "react";
import { updateWorker } from "@/features/workers/actions";
import { getWorker, workerKeys } from "@/features/workers/api";
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
import { isNotFound, messageFrom } from "@/shared/lib/errors";
import type { LifecycleStatus } from "@/shared/lib/status-labels";
import { Button } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";

const TABS = [
  "Profile",
  "Personal / PII",
  "Background check",
  "Certs",
  "Skills",
  "Availability",
  "Education",
  "Employment history",
  "Time off",
  "Documents",
  "Incidents",
  "Consent",
] as const;
type Tab = (typeof TABS)[number];

export default function WorkerDetailPage() {
  const { id: workerId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("Profile");
  const [editingProfile, setEditingProfile] = useState(false);

  const query = useQuery({
    queryKey: workerKeys.detail(workerId),
    queryFn: () => getWorker(workerId),
    retry: false,
  });

  if (query.isError && isNotFound(query.error)) {
    notFound();
  }

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-3xl text-cadence-ink">
            {worker.first_name} {worker.last_name}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <LifecycleStatusBadge status={worker.lifecycle_status as LifecycleStatus} />
            {"rating" in worker ? (
              <span className="font-body text-sm text-cadence-ink/60">Rating {worker.rating}</span>
            ) : null}
          </div>
        </div>
        <WorkerLifecycleActions worker={worker} onChanged={refetch} />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-t-md px-3 py-2 font-body text-sm",
              tab === t
                ? "border-b-2 border-cadence-red text-cadence-ink"
                : "text-cadence-ink/60 hover:text-cadence-ink",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div>
        {tab === "Profile" ? (
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
                  (worker.employment_type as WorkerProfileFormValues["employment_type"]) ?? "",
                work_authorization:
                  (worker.work_authorization as WorkerProfileFormValues["work_authorization"]) ??
                  "",
                work_status: (worker.work_status as WorkerProfileFormValues["work_status"]) ?? "",
                pay_method: (worker.pay_method as WorkerProfileFormValues["pay_method"]) ?? "",
                notification_channel: worker.notification_channel,
                referral_source: worker.referral_source ?? "",
              }}
              onSubmit={handleUpdateProfile}
              submitLabel="Save changes"
            />
          ) : (
            <div className="flex flex-col gap-4">
              <Button
                size="sm"
                variant="secondary"
                className="self-start"
                onClick={() => setEditingProfile(true)}
              >
                Edit profile
              </Button>
              <dl className="grid max-w-xl grid-cols-2 gap-x-8 gap-y-3 font-body text-sm">
                <div>
                  <dt className="text-cadence-ink/60">Email</dt>
                  <dd className="text-cadence-ink">{worker.email || "—"}</dd>
                </div>
                <div>
                  <dt className="text-cadence-ink/60">Phone</dt>
                  <dd className="text-cadence-ink">{worker.phone || "—"}</dd>
                </div>
                <div>
                  <dt className="text-cadence-ink/60">Address</dt>
                  <dd className="text-cadence-ink">
                    {[worker.address_line_1, worker.city, worker.province, worker.postal_code]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-cadence-ink/60">Emergency contact</dt>
                  <dd className="text-cadence-ink">
                    {[worker.emergency_contact_name, worker.emergency_contact_phone]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-cadence-ink/60">Employment type</dt>
                  <dd className="text-cadence-ink">{worker.employment_type || "—"}</dd>
                </div>
                <div>
                  <dt className="text-cadence-ink/60">Work authorization</dt>
                  <dd className="text-cadence-ink">{worker.work_authorization || "—"}</dd>
                </div>
                <div>
                  <dt className="text-cadence-ink/60">Work status</dt>
                  <dd className="text-cadence-ink">{worker.work_status || "—"}</dd>
                </div>
                <div>
                  <dt className="text-cadence-ink/60">Pay method</dt>
                  <dd className="text-cadence-ink">{worker.pay_method || "—"}</dd>
                </div>
              </dl>
            </div>
          )
        ) : null}

        {tab === "Personal / PII" ? (
          <WorkerPersonalPanel worker={worker} onRefetch={refetch} />
        ) : null}
        {tab === "Background check" ? (
          <BackgroundCheckPanel worker={worker} onRefetch={refetch} />
        ) : null}
        {tab === "Certs" ? <CertsPanel workerId={workerId} /> : null}
        {tab === "Skills" ? <SkillsPanel workerId={workerId} /> : null}
        {tab === "Availability" ? <AvailabilityPanel workerId={workerId} /> : null}
        {tab === "Education" ? <EducationPanel workerId={workerId} /> : null}
        {tab === "Employment history" ? <EmploymentHistoryPanel workerId={workerId} /> : null}
        {tab === "Time off" ? <TimeOffPanel workerId={workerId} /> : null}
        {tab === "Documents" ? <WorkerDocumentsPanel workerId={workerId} /> : null}
        {tab === "Incidents" ? <IncidentsPanel workerId={workerId} /> : null}
        {tab === "Consent" ? <ConsentPanel worker={worker} /> : null}
      </div>
    </div>
  );
}
