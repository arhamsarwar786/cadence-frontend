"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PayStatementStatusBadge } from "@/features/money/components/StatusBadges";
import { listPayslips } from "@/features/portal/api";
import { messageFrom } from "@/shared/lib/errors";
import { formatMoney } from "@/shared/lib/money";
import type { PayStatementStatus } from "@/shared/lib/status-labels";
import { ListSkeleton, Table, type Column } from "@/shared/ui";
import type { PayStatement } from "@/features/money/types";
import { PortalFrame } from "../../_components/PortalFrame";

export default function PortalPayStatementsPage() {
  const query = useQuery({ queryKey: ["portal", "pay-statements"], queryFn: listPayslips });

  const columns: Column<PayStatement>[] = [
    { header: "Gross", cell: (p) => ("gross" in p ? formatMoney(p.gross) : "—") },
    { header: "Net", cell: (p) => ("net_amount" in p ? formatMoney(p.net_amount) : "—") },
    { header: "Hours", cell: (p) => p.hours_total ?? "—" },
    {
      header: "Status",
      cell: (p) => <PayStatementStatusBadge status={p.status as PayStatementStatus} />,
    },
    {
      header: "",
      cell: (p) => (
        <div className="flex gap-3">
          <Link href={`/portal/pay-statements/${p.id}`} className="underline">
            Details
          </Link>
          <a
            href={`/api/v1/portal/me/pay-statements/${p.id}/pdf/`}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            PDF
          </a>
        </div>
      ),
    },
  ];

  return (
    <PortalFrame
      title="Pay statements"
      subtitle="Issued and paid statements for you only. Drafts stay in the office until they are released."
    >
      <p className="mb-4 rounded-2xl bg-cadence-yellow/40 px-4 py-3 font-body text-sm text-cadence-ink">
        This is a pay statement, not your official pay record.
      </p>
      {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError ? (
        <p className="font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>
      ) : (
        <Table
          columns={columns}
          rows={query.data ?? []}
          rowKey={(p) => p.id}
          emptyMessage="No pay statements yet — issued and paid statements appear here."
        />
      )}
    </PortalFrame>
  );
}
