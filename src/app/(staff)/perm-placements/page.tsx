"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  confirmPlacement,
  createPlacement,
  voidPlacement,
} from "@/features/money/actions";
import { getPlacement, listPlacements, placementKeys } from "@/features/money/api";
import type { Placement } from "@/features/money/types";
import { messageFrom } from "@/shared/lib/errors";
import { formatMoney } from "@/shared/lib/money";
import { PERM } from "@/permissions/keys";
import { Button, Chip, Dialog, Field, Input, ListLayout, ListSkeleton, PageHeader, Pagination, PermGate, Table, type Column, PageFrame, PageBody } from "@/shared/ui";

const PAGE_SIZE = 50;

export default function PermPlacementsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    client_id: "",
    employee_id: "",
    job_id: "",
    annual_salary: "",
    fee_pct: "",
  });

  const query = useQuery({
    queryKey: placementKeys.list({ page }),
    queryFn: () => listPlacements({ page, pageSize: PAGE_SIZE }),
  });

  const columns: Column<Placement>[] = [
    { header: "Worker", cell: (p) => p.employee_name },
    { header: "Client", cell: (p) => p.client_name },
    {
      header: "Status",
      cell: (p) => (
        <Chip tone={p.voided_at ? "danger" : p.status === "confirmed" ? "success" : "muted"}>
          {p.voided_at ? "voided" : p.status}
        </Chip>
      ),
    },
    {
      header: "Fee",
      cell: (p) => ("fee_amount" in p && p.fee_amount != null ? formatMoney(p.fee_amount) : "—"),
    },
    { header: "Confirmed", cell: (p) => p.confirmed_at?.slice(0, 10) ?? "—" },
  ];

  async function submitCreate() {
    setError(null);
    try {
      const row = await createPlacement({
        client_id: form.client_id,
        employee_id: form.employee_id,
        job_id: form.job_id || null,
        annual_salary: form.annual_salary,
        fee_pct: form.fee_pct,
      } as never);
      await queryClient.invalidateQueries({ queryKey: placementKeys.all });
      setOpen(false);
      router.push(`/perm-placements/${row.id}`);
    } catch (err) {
      setError(messageFrom(err));
    }
  }

  return (
    <PageFrame>
      <PageHeader
        title="Permanent placements"
        actions={
          <PermGate anyOf={PERM.JOBS_ASSIGN}>
            <Button onClick={() => setOpen(true)}>New placement</Button>
          </PermGate>
        }
      />
      <PageBody>

        {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError ? (
        <p className="text-sm text-cadence-red">{messageFrom(query.error)}</p>
      ) : (
        <ListLayout stats={[{ value: query.data?.count ?? 0, label: "placements", tone: "ink" }]}>
          <Table
            columns={columns}
            rows={query.data?.results ?? []}
            rowKey={(p) => p.id}
            onRowClick={(p) => router.push(`/perm-placements/${p.id}`)}
            emptyMessage="No permanent placements yet."
          />
          {query.data ? (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              count={query.data.count}
              onPageChange={(p) => router.push(`/perm-placements?page=${p}`)}
            />
          ) : null}
        </ListLayout>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="New permanent placement">
        <div className="flex flex-col gap-3">
          <Field label="Client id" htmlFor="pl-client">
            <Input id="pl-client" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} />
          </Field>
          <Field label="Employee id" htmlFor="pl-emp">
            <Input id="pl-emp" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} />
          </Field>
          <Field label="Job id (optional)" htmlFor="pl-job">
            <Input id="pl-job" value={form.job_id} onChange={(e) => setForm({ ...form, job_id: e.target.value })} />
          </Field>
          <Field label="Annual salary" htmlFor="pl-sal">
            <Input id="pl-sal" value={form.annual_salary} onChange={(e) => setForm({ ...form, annual_salary: e.target.value })} />
          </Field>
          <Field label="Fee %" htmlFor="pl-fee">
            <Input id="pl-fee" value={form.fee_pct} onChange={(e) => setForm({ ...form, fee_pct: e.target.value })} />
          </Field>
          {error ? <p className="text-sm text-cadence-red">{error}</p> : null}
          <Button onClick={submitCreate}>Create</Button>
        </div>
      </Dialog>
    </PageBody>
    </PageFrame>
  );
}

export function PlacementActions({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: placementKeys.detail(id), queryFn: () => getPlacement(id) });
  if (!query.data) return null;
  const p = query.data;
  return (
    <div className="flex gap-2">
      {p.status === "offered" && !p.voided_at ? (
        <Button
          onClick={async () => {
            await confirmPlacement(id);
            await queryClient.invalidateQueries({ queryKey: placementKeys.detail(id) });
          }}
        >
          Confirm
        </Button>
      ) : null}
      {!p.voided_at ? (
        <Button
          variant="danger"
          onClick={async () => {
            await voidPlacement(id);
            await queryClient.invalidateQueries({ queryKey: placementKeys.detail(id) });
          }}
        >
          Void
        </Button>
      ) : null}
    </div>
  );
}
