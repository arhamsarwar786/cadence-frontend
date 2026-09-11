"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { invoiceKeys, listInvoices } from "@/features/money/api";
import { InvoiceStatusBadge } from "@/features/money/components/StatusBadges";
import type { Invoice } from "@/features/money/types";
import { messageFrom } from "@/shared/lib/errors";
import { formatMoney } from "@/shared/lib/money";
import type { InvoiceStatus } from "@/shared/lib/status-labels";
import { Button, Pagination, Table, type Column } from "@/shared/ui";

const PAGE_SIZE = 50;

export default function InvoicesListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const status = searchParams.get("status") ?? undefined;

  const query = useQuery({
    queryKey: invoiceKeys.list({ page, status }),
    queryFn: () => listInvoices({ page, pageSize: PAGE_SIZE, status }),
  });

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(nextPage));
    router.push(`/invoices?${params.toString()}`);
  }

  function setStatusFilter(nextStatus: string) {
    const params = new URLSearchParams(searchParams);
    if (nextStatus) params.set("status", nextStatus);
    else params.delete("status");
    params.set("page", "1");
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
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl text-cadence-ink">Invoices</h1>
        <Link href="/invoices/new">
          <Button>New invoice</Button>
        </Link>
      </div>

      <div className="flex gap-2">
        {["", "draft", "pending_approval", "approved", "sent"].map((s) => (
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
            rowKey={(i) => i.id}
            onRowClick={(i) => router.push(`/invoices/${i.id}`)}
            emptyMessage="No invoices yet."
          />
          {query.data ? (
            <Pagination page={page} pageSize={PAGE_SIZE} count={query.data.count} onPageChange={goToPage} />
          ) : null}
        </>
      )}
    </div>
  );
}
