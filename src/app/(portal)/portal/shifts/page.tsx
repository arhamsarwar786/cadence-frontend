"use client";

import { useQuery } from "@tanstack/react-query";
import { ShiftStatusBadge } from "@/features/jobs/components/StatusBadges";
import { listShifts } from "@/features/portal/api";
import type { ShiftStatus } from "@/shared/lib/status-labels";
import { ListSkeleton, QueryError, Table, type Column } from "@/shared/ui";
import type { PortalShift } from "@/features/portal/types";
import { PortalFrame } from "../../_components/PortalFrame";
import { formatTimeRange } from "@/shared/lib/datetime";

export default function PortalShiftsPage() {
  const query = useQuery({ queryKey: ["portal", "shifts"], queryFn: listShifts });
  const shifts = (query.data ?? []).filter((s) => s.offer_status !== "offered");

  const columns: Column<PortalShift>[] = [
    { header: "Date", cell: (s) => s.shift_date },
    { header: "Job", cell: (s) => s.job_title },
    { header: "Client", cell: (s) => s.client_name },
    { header: "Time", cell: (s) => formatTimeRange(s.start_time, s.end_time) },
    { header: "Status", cell: (s) => <ShiftStatusBadge status={s.status as ShiftStatus} /> },
  ];

  return (
    <PortalFrame
      title="My shifts"
      subtitle="Shifts on placements you have confirmed. Pending offers live on the Offers screen."
    >
      {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <Table columns={columns} rows={shifts} rowKey={(s) => s.id} emptyMessage="No shifts scheduled." />
      )}
    </PortalFrame>
  );
}
