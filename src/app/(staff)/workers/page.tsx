"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LifecycleStatusBadge } from "@/features/workers/components/LifecycleStatusBadge";
import { listWorkers, workerKeys } from "@/features/workers/api";
import type { EmployeeList } from "@/features/workers/types";
import { messageFrom } from "@/shared/lib/errors";
import type { LifecycleStatus } from "@/shared/lib/status-labels";
import { Button, Pagination, Table, type Column } from "@/shared/ui";

const PAGE_SIZE = 50;

export default function WorkersListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1") || 1;

  const query = useQuery({
    queryKey: workerKeys.list({ page }),
    queryFn: () => listWorkers({ page, pageSize: PAGE_SIZE }),
  });

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(nextPage));
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
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl text-cadence-ink">Workers</h1>
        <Link href="/workers/new">
          <Button>New worker</Button>
        </Link>
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
            rowKey={(w) => w.id}
            onRowClick={(w) => router.push(`/workers/${w.id}`)}
            emptyMessage="No workers yet."
          />
          {query.data ? (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              count={query.data.count}
              onPageChange={goToPage}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
