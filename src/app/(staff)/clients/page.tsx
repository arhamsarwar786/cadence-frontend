"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { clientKeys, listClients } from "@/features/clients/api";
import { ClientStatusBadge } from "@/features/clients/components/ClientStatusBadge";
import type { Client } from "@/features/clients/types";
import { messageFrom } from "@/shared/lib/errors";
import type { ClientStatus } from "@/shared/lib/status-labels";
import { Button, Pagination, Table, type Column } from "@/shared/ui";

const PAGE_SIZE = 50;

export default function ClientsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1") || 1;

  const query = useQuery({
    queryKey: clientKeys.list({ page }),
    queryFn: () => listClients({ page, pageSize: PAGE_SIZE }),
  });

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(nextPage));
    router.push(`/clients?${params.toString()}`);
  }

  const columns: Column<Client>[] = [
    { header: "Name", cell: (c) => c.name },
    { header: "Status", cell: (c) => <ClientStatusBadge status={c.status as ClientStatus} /> },
    { header: "City", cell: (c) => c.city },
    { header: "Province", cell: (c) => c.province },
    {
      header: "Markup %",
      // Gated field (clients.markup.view) — omitted from JSON, not null,
      // when the caller lacks the key (ARCHITECTURE.md §2.3/§9).
      cell: (c) => ("markup_pct" in c ? `${c.markup_pct}%` : "—"),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl text-cadence-ink">Clients</h1>
        <Link href="/clients/new">
          <Button>New client</Button>
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
            rowKey={(c) => c.id}
            onRowClick={(c) => router.push(`/clients/${c.id}`)}
            emptyMessage="No clients yet."
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
