"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { invoiceKeys, listInvoices } from "@/features/money/api";
import { InvoiceStatusBadge } from "@/features/money/components/StatusBadges";
import type { Invoice } from "@/features/money/types";
import { messageFrom } from "@/shared/lib/errors";
import { matchesQuery } from "@/shared/lib/matches";
import { formatMoney } from "@/shared/lib/money";
import type { InvoiceStatus } from "@/shared/lib/status-labels";
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
  Table,
  type Column,
} from "@/shared/ui";

const PAGE_SIZE = 50;
const FIND_WINDOW = 200;

export default function InvoicesListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const status = searchParams.get("status") ?? undefined;
  const q = searchParams.get("q") ?? "";
  const finding = q.trim().length > 0;

  const query = useQuery({
    queryKey: invoiceKeys.list({ page: finding ? 1 : page, status, find: finding }),
    queryFn: () =>
      listInvoices({
        page: finding ? 1 : page,
        pageSize: finding ? FIND_WINDOW : PAGE_SIZE,
        status,
      }),
  });

  const rows = useMemo(() => {
    const results = query.data?.results ?? [];
    if (!finding) return results;
    return results.filter(
      (invoice) =>
        matchesQuery(invoice.client_name, q) ||
        matchesQuery(invoice.invoice_number ?? "", q),
    );
  }, [finding, q, query.data?.results]);

  function setParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`/invoices?${params.toString()}`);
  }

  const columns: Column<Invoice>[] = [
    { header: "Invoice #", cell: (i) => i.invoice_number ?? "—" },
    { header: "Client", cell: (i) => i.client_name },
    { header: "Status", cell: (i) => <InvoiceStatusBadge status={i.status as InvoiceStatus} /> },
    { header: "Total", cell: (i) => ("total" in i ? formatMoney(i.total) : "—") },
    { header: "Due", cell: (i) => i.due_date },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Invoices"
        actions={
          <PermGate anyOf={PERM.CLIENTS_INVOICE_CREATE}>
            <Link href="/invoices/new">
              <Button>New invoice</Button>
            </Link>
          </PermGate>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchField
          value={q}
          onChange={(next) => setParams({ q: next || null, page: "1" })}
          placeholder="Find by number or client"
          label="Find invoices"
        />
        <div className="flex flex-wrap gap-2">
          {["", "draft", "pending_approval", "approved", "sent"].map((s) => (
            <FilterChip
              key={s || "all"}
              active={(status ?? "") === s}
              onClick={() => setParams({ status: s || null, page: "1" })}
            >
              {s ? s.replaceAll("_", " ") : "All"}
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
              label: finding ? "matches" : "invoices",
              tone: "ink",
            },
          ]}
        >
          <div className="flex flex-col gap-4">
            {finding && (query.data?.count ?? 0) > FIND_WINDOW ? (
              <p className="font-body text-xs text-cadence-ink/60">
                Showing matches in the first {FIND_WINDOW} of {query.data?.count} invoices.
              </p>
            ) : null}
            <Table
              columns={columns}
              rows={rows}
              rowKey={(i) => i.id}
              onRowClick={(i) => router.push(`/invoices/${i.id}`)}
              emptyMessage={finding ? "No invoices match that find." : "No invoices yet."}
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
