"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createJob } from "@/features/jobs/actions";
import { jobKeys } from "@/features/jobs/api";
import { JobForm } from "@/features/jobs/components/JobForm";
import type { JobFormValues } from "@/features/jobs/schemas";
import type { JobWrite } from "@/features/jobs/types";

export default function NewJobPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  async function handleSubmit(values: JobFormValues) {
    const job = await createJob({
      title: values.title,
      client: values.client,
      bill_rate: values.bill_rate,
      bill_rate_unit: values.bill_rate_unit,
      markup_pct: values.markup_pct || undefined,
      headcount_needed: values.headcount_needed,
      start_datetime: values.start_datetime,
      end_datetime: values.end_datetime,
      po_number: values.po_number || undefined,
      invoice_date: values.invoice_date || undefined,
    } as JobWrite);
    await queryClient.invalidateQueries({ queryKey: jobKeys.all });
    router.push(`/jobs/${job.id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-3xl text-cadence-ink">New job</h1>
      <JobForm onSubmit={handleSubmit} submitLabel="Create job" />
    </div>
  );
}
