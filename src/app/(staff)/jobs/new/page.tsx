"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createJob } from "@/features/jobs/actions";
import { jobKeys } from "@/features/jobs/api";
import { JobForm } from "@/features/jobs/components/JobForm";
import type { JobFormValues } from "@/features/jobs/schemas";
import type { JobWrite } from "@/features/jobs/types";
import { useOrgTimeZone } from "@/auth/use-org-timezone";
import { PERM } from "@/permissions/keys";
import { orgLocalToUtcIso } from "@/shared/lib/datetime";
import { PageFrame, PageScrollRegion, useHasPerm } from "@/shared/ui";

export default function NewJobPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canEditBillRate = useHasPerm(PERM.JOBS_BILL_RATE_EDIT);
  const timeZone = useOrgTimeZone();

  async function handleSubmit(values: JobFormValues) {
    if (!canEditBillRate || !values.bill_rate?.trim()) {
      throw new Error("setting the bill rate requires jobs.bill_rate.edit");
    }
    if (!timeZone) throw new Error("Organization timezone is not loaded yet. Try again.");
    const job = await createJob({
      title: values.title,
      client: values.client,
      bill_rate: values.bill_rate,
      bill_rate_unit: values.bill_rate_unit,
      markup_pct: values.markup_pct || undefined,
      headcount_needed: values.headcount_needed,
      start_datetime: orgLocalToUtcIso(values.start_datetime, timeZone),
      end_datetime: orgLocalToUtcIso(values.end_datetime, timeZone),
      po_number: values.po_number || undefined,
      invoice_date: values.invoice_date || undefined,
    } as JobWrite);
    await queryClient.invalidateQueries({ queryKey: jobKeys.all });
    router.push(`/jobs/${job.id}`);
  }

  return (
    <PageFrame>
      <PageScrollRegion className="flex flex-col gap-4">
        <h1 className="font-heading text-3xl text-cadence-ink">New job</h1>
        <JobForm mode="create" onSubmit={handleSubmit} submitLabel="Create job" />
      </PageScrollRegion>
    </PageFrame>
  );
}
