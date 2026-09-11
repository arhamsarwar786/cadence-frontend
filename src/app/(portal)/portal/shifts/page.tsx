"use client";

import { useQuery } from "@tanstack/react-query";
import { ShiftStatusBadge } from "@/features/jobs/components/StatusBadges";
import { listShifts } from "@/features/portal/api";
import { messageFrom } from "@/shared/lib/errors";
import type { ShiftStatus } from "@/shared/lib/status-labels";
import { Table, type Column } from "@/shared/ui";
import type { PortalShift } from "@/features/portal/types";

export default function PortalShiftsPage() {
  const query = useQuery({ queryKey: ["portal", "shifts"], queryFn: listShifts });

  const shifts = (query.data ?? []).filter((s) => s.offer_status === "confirmed");

  const columns: Column<PortalShift>[] = [
    { header: "Date", cell: (s) => s.shift_date },
    { header: "Job", cell: (s) => s.job_title },
    { header: "Client", cell: (s) => s.client_name },
    { header: "Time", cell: (s) => `${s.start_time}–${s.end_time}` },
    { header: "Status", cell: (s) => <ShiftStatusBadge status={s.status as ShiftStatus} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-3xl text-cadence-ink">My shifts</h1>
      {query.isLoading ? (
        <p className="font-body text-sm text-cadence-ink/60">Loading…</p>
      ) : query.isError ? (
        <p className="font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>
      ) : (
        <Table columns={columns} rows={shifts} rowKey={(s) => s.id} emptyMessage="No shifts scheduled." />
      )}
    </div>
  );
}
