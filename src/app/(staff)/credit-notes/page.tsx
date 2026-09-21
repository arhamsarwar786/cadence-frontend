"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { listCreditNotes, creditNoteKeys } from "@/features/money/api";
import type { CreditNote } from "@/features/money/types";
import { messageFrom } from "@/shared/lib/errors";
import { formatMoney } from "@/shared/lib/money";
import { Chip, ListLayout, ListSkeleton, PageHeader, Pagination, Table, type Column } from "@/shared/ui";

const PAGE_SIZE = 50;

export default function CreditNotesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1") || 1;

  const query = useQuery({
    queryKey: creditNoteKeys.list({ page }),
    queryFn: () => listCreditNotes({ page, pageSize: PAGE_SIZE }),
  });

  const columns: Column<CreditNote>[] = [
    { header: "Number", cell: (n) => n.credit_note_number },
    { header: "Client", cell: (n) => n.client_name },
    { header: "Invoice", cell: (n) => n.invoice_number },
    {
      header: "Status",
      cell: (n) => (
        <Chip tone={n.voided_at ? "danger" : n.status === "issued" ? "success" : "muted"}>
          {n.voided_at ? "Voided" : n.status}
        </Chip>
      ),
    },
    { header: "Total", cell: (n) => ("total" in n ? formatMoney(n.total) : "—") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Credit notes" />
      {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError ? (
        <p className="text-sm text-cadence-red">{messageFrom(query.error)}</p>
      ) : (
        <ListLayout stats={[{ value: query.data?.count ?? 0, label: "notes", tone: "ink" }]}>
          <Table
            columns={columns}
            rows={query.data?.results ?? []}
            rowKey={(n) => n.id}
            onRowClick={(n) => router.push(`/credit-notes/${n.id}`)}
            emptyMessage="No credit notes yet."
          />
          {query.data ? (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              count={query.data.count}
              onPageChange={(p) => router.push(`/credit-notes?page=${p}`)}
            />
          ) : null}
        </ListLayout>
      )}
    </div>
  );
}
