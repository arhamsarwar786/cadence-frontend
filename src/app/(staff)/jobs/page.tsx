"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { jobKeys, listJobs } from "@/features/jobs/api";
import { JobStatusBadge } from "@/features/jobs/components/StatusBadges";
import type { Job } from "@/features/jobs/types";
import { formatMoney } from "@/shared/lib/money";
import { messageFrom } from "@/shared/lib/errors";
import type { JobStatus } from "@/shared/lib/status-labels";
import { Button, Pagination, Table, type Column } from "@/shared/ui";

const PAGE_SIZE = 50;

export default function JobsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const status = searchParams.get("status") ?? undefined;

  const query = useQuery({
    queryKey: jobKeys.list({ page, status }),
    queryFn: () => listJobs({ page, pageSize: PAGE_SIZE, status }),
  });

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(nextPage));
    router.push(`/jobs?${params.toString()}`);
  }

  function setStatusFilter(nextStatus: string) {
    const params = new URLSearchParams(searchParams);
    if (nextStatus) params.set("status", nextStatus);
    else params.delete("status");
    params.set("page", "1");
    router.push(`/jobs?${params.toString()}`);
  }

  const columns: Column<Job>[] = [
    { header: "Title", cell: (j) => j.title },
    { header: "Client", cell: (j) => j.client_name },
    { header: "Status", cell: (j) => <JobStatusBadge status={j.status as JobStatus} /> },
    { header: "Bill rate", cell: (j) => ("bill_rate" in j ? formatMoney(j.bill_rate) : "—") },
    { header: "Headcount", cell: (j) => j.headcount_needed ?? "—" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl text-cadence-ink">Jobs</h1>
        <Link href="/jobs/new">
          <Button>New job</Button>
        </Link>
      </div>

      <div className="flex gap-2">
        {["", "open", "filled", "cancelled", "completed"].map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 font-body text-xs ${
              (status ?? "") === s
                ? "bg-cadence-red text-white"
                : "bg-surface-muted text-cadence-ink/70"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <p className="font-body text-sm text-cadence-ink/60">Loading…</p>
      ) : query.isError ? (
        <p className="font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>
      ) : (
        <>
          <Table
            columns={columns}
            rows={query.data?.results ?? []}
            rowKey={(j) => j.id}
            onRowClick={(j) => router.push(`/jobs/${j.id}`)}
            emptyMessage="No jobs yet."
          />
          {query.data ? (
            <Pagination page={page} pageSize={PAGE_SIZE} count={query.data.count} onPageChange={goToPage} />
          ) : null}
        </>
      )}
    </div>
  );
}
