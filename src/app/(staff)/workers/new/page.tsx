"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createWorker } from "@/features/workers/actions";
import { workerKeys } from "@/features/workers/api";
import { WorkerProfileForm } from "@/features/workers/components/WorkerProfileForm";
import type { WorkerProfileFormValues } from "@/features/workers/schemas";
import type { EmployeeWrite } from "@/features/workers/types";

export default function NewWorkerPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  async function handleSubmit(values: WorkerProfileFormValues) {
    const cleaned: EmployeeWrite = {
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
    };
    const worker = await createWorker(cleaned);
    await queryClient.invalidateQueries({ queryKey: workerKeys.all });
    router.push(`/workers/${worker.id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-3xl text-cadence-ink">New worker</h1>
      <WorkerProfileForm onSubmit={handleSubmit} submitLabel="Create worker" />
    </div>
  );
}
