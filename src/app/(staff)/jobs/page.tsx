"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { jobKeys, listJobs } from "@/features/jobs/api";
import { listClients } from "@/features/clients/api";
import { JobStatusBadge } from "@/features/jobs/components/StatusBadges";
import type { Job } from "@/features/jobs/types";
import { formatMoney } from "@/shared/lib/money";
import { messageFrom } from "@/shared/lib/errors";
import { matchesQuery } from "@/shared/lib/matches";
import type { JobStatus } from "@/shared/lib/status-labels";
import { PERM } from "@/permissions/keys";
import {
  Button,
  FilterChip,
  ListLayout,
  ListSkeleton,
  PageHeader,
  Pagination,
  PermGate,
  SearchField,
  Select,
  Table,
  type Column,
} from "@/shared/ui";

const PAGE_SIZE = 50;
const FIND_WINDOW = 200;

export default function JobsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const status = searchParams.get("status") ?? undefined;
  const client = searchParams.get("client") ?? undefined;
  const q = searchParams.get("q") ?? "";
  const finding = q.trim().length > 0;

  const clientsQuery = useQuery({
    queryKey: ["clients-picker"],
    queryFn: () => listClients({ pageSize: 200 }),
  });

  const query = useQuery({
    queryKey: jobKeys.list({ page: finding ? 1 : page, status, client, find: finding }),
    queryFn: () =>
      listJobs({
        page: finding ? 1 : page,
        pageSize: finding ? FIND_WINDOW : PAGE_SIZE,
        status,
        client,
      }),
  });

  const rows = useMemo(() => {
    const results = query.data?.results ?? [];
    if (!finding) return results;
    return results.filter(
      (job) => matchesQuery(job.title, q) || matchesQuery(job.client_name, q),
    );
  }, [finding, q, query.data?.results]);

  function setParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
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
      <PageHeader
        title="Jobs"
        actions={
          <PermGate anyOf={PERM.JOBS_CREATE}>
            <Link href="/jobs/new">
              <Button>New job</Button>
            </Link>
          </PermGate>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchField
          value={q}
          onChange={(next) => setParams({ q: next || null, page: "1" })}
          placeholder="Find by title or client"
          label="Find jobs"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="!w-auto"
            value={client ?? ""}
            onChange={(e) => setParams({ client: e.target.value || null, page: "1" })}
            aria-label="Filter by client"
          >
            <option value="">All clients</option>
            {(clientsQuery.data?.results ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          {["", "open", "filled", "cancelled", "completed"].map((s) => (
            <FilterChip
              key={s || "all"}
              active={(status ?? "") === s}
              onClick={() => setParams({ status: s || null, page: "1" })}
            >
              {s || "All"}
            </FilterChip>
          ))}
        </div>
      </div>

      {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError ? (
        <p className="font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>
      ) : (
        <ListLayout
          stats={[
            {
              value: finding ? rows.length : (query.data?.count ?? 0),
              label: finding ? "matches" : "jobs",
              tone: "ink",
            },
          ]}
        >
          <div className="flex flex-col gap-4">
            {finding && (query.data?.count ?? 0) > FIND_WINDOW ? (
              <p className="font-body text-xs text-cadence-ink/60">
                Showing matches in the first {FIND_WINDOW} of {query.data?.count} jobs
                {status ? " in this status" : ""}.
              </p>
            ) : null}
            <Table
              columns={columns}
              rows={rows}
              rowKey={(j) => j.id}
              onRowClick={(j) => router.push(`/jobs/${j.id}`)}
              emptyMessage={finding ? "No jobs match that find." : "No jobs yet."}
            />
            {!finding && query.data ? (
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                count={query.data.count}
                onPageChange={(nextPage) => setParams({ page: String(nextPage) })}
              />
            ) : null}
          </div>
        </ListLayout>
      )}
    </div>
  );
}
