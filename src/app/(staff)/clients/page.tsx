"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { clientKeys, listClients } from "@/features/clients/api";
import { ClientStatusBadge } from "@/features/clients/components/ClientStatusBadge";
import type { Client } from "@/features/clients/types";
import { PERM } from "@/permissions/keys";
import { messageFrom } from "@/shared/lib/errors";
import { matchesQuery } from "@/shared/lib/matches";
import type { ClientStatus } from "@/shared/lib/status-labels";
import {
  Avatar,
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

export default function ClientsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const q = searchParams.get("q") ?? "";
  const finding = q.trim().length > 0;

  const query = useQuery({
    queryKey: clientKeys.list({ page: finding ? 1 : page, find: finding }),
    queryFn: () =>
      listClients({
        page: finding ? 1 : page,
        pageSize: finding ? FIND_WINDOW : PAGE_SIZE,
      }),
  });

  const rows = useMemo(() => {
    const results = query.data?.results ?? [];
    if (!finding) return results;
    return results.filter((client) => matchesQuery(client.name, q));
  }, [finding, q, query.data?.results]);

  function setParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`/clients?${params.toString()}`);
  }

  const columns: Column<Client>[] = [
    {
      header: "Client",
      cell: (c) => (
        <span className="flex items-center gap-2">
          <Avatar name={c.name} size="sm" />
          <span>
            <span className="block font-medium">{c.name}</span>
            <ClientStatusBadge status={c.status as ClientStatus} />
          </span>
        </span>
      ),
    },
    {
      header: "Office address",
      className: "hidden sm:table-cell",
      cell: (c) =>
        [c.address_line_1, c.city, c.province, c.postal_code].filter(Boolean).join(", ") || "—",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Clients"
        actions={
          <PermGate anyOf={PERM.CLIENTS_CREATE}>
            <Link href="/clients/new">
              <Button>New client</Button>
            </Link>
          </PermGate>
        }
      />
      <SearchField
        value={q}
        onChange={(next) => setParams({ q: next || null, page: "1" })}
        placeholder="Find by name"
        label="Find clients"
      />
      <p className="font-body text-xs text-cadence-ink/50">
        Manager / alternate contact columns need the list serializer to embed contacts — not fetched
        per row.
      </p>

      {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError ? (
        <p className="font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>
      ) : (
        <ListLayout
          stats={[
            {
              value: finding ? rows.length : (query.data?.count ?? 0),
              label: finding ? "matches" : "clients",
              tone: "ink",
            },
          ]}
        >
          <div className="flex flex-col gap-4">
            {finding && (query.data?.count ?? 0) > FIND_WINDOW ? (
              <p className="font-body text-xs text-cadence-ink/60">
                Showing matches in the first {FIND_WINDOW} of {query.data?.count} clients.
              </p>
            ) : null}
            <Table
              columns={columns}
              rows={rows}
              rowKey={(c) => c.id}
              onRowClick={(c) => router.push(`/clients/${c.id}`)}
              emptyMessage={finding ? "No clients match that name in this set." : "No clients yet."}
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
