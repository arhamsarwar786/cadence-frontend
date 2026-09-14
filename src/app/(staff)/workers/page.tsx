"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LifecycleStatusBadge } from "@/features/workers/components/LifecycleStatusBadge";
import { listWorkers, workerKeys } from "@/features/workers/api";
import type { EmployeeList } from "@/features/workers/types";
import { PERM } from "@/permissions/keys";
import { messageFrom } from "@/shared/lib/errors";
import { matchesQuery } from "@/shared/lib/matches";
import type { LifecycleStatus } from "@/shared/lib/status-labels";
import {
  Button,
  ListLayout,
  ListSkeleton,
  PageHeader,
  Pagination,
  PermGate,
  SearchField,
  Table,
  type Column,
} from "@/shared/ui";

const PAGE_SIZE = 50;
const FIND_WINDOW = 200;

export default function WorkersListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const q = searchParams.get("q") ?? "";
  const finding = q.trim().length > 0;

  const query = useQuery({
    queryKey: workerKeys.list({ page: finding ? 1 : page, find: finding }),
    queryFn: () =>
      listWorkers({
        page: finding ? 1 : page,
        pageSize: finding ? FIND_WINDOW : PAGE_SIZE,
      }),
  });

  const rows = useMemo(() => {
    const results = query.data?.results ?? [];
    if (!finding) return results;
    return results.filter((worker) =>
      matchesQuery(`${worker.first_name} ${worker.last_name}`, q),
    );
  }, [finding, q, query.data?.results]);

  function setParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`/workers?${params.toString()}`);
  }

  const columns: Column<EmployeeList>[] = [
    { header: "Name", cell: (w) => `${w.first_name} ${w.last_name}` },
    {
      header: "Lifecycle",
      cell: (w) => <LifecycleStatusBadge status={w.lifecycle_status as LifecycleStatus} />,
    },
    { header: "Work status", cell: (w) => w.work_status ?? "—" },
    { header: "Rating", cell: (w) => w.rating },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Workers"
        actions={
          <PermGate anyOf={PERM.WORKERS_CREATE}>
            <Link href="/workers/new">
              <Button>New worker</Button>
            </Link>
          </PermGate>
        }
      />
      <SearchField
        value={q}
        onChange={(next) => setParams({ q: next || null, page: "1" })}
        placeholder="Find by name"
        label="Find workers"
      />

      {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError ? (
        <p className="font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>
      ) : (
        <ListLayout
          stats={[
            {
              value: finding ? rows.length : (query.data?.count ?? 0),
              label: finding ? "matches" : "total",
              tone: "ink",
            },
          ]}
        >
          <div className="flex flex-col gap-4">
            {finding && (query.data?.count ?? 0) > FIND_WINDOW ? (
              <p className="font-body text-xs text-cadence-ink/60">
                Showing matches in the first {FIND_WINDOW} of {query.data?.count} workers.
              </p>
            ) : null}
            <Table
              columns={columns}
              rows={rows}
              rowKey={(w) => w.id}
              onRowClick={(w) => router.push(`/workers/${w.id}`)}
              emptyMessage={finding ? "No workers match that name in this set." : "No workers yet."}
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
