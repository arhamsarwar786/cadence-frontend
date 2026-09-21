"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, type Paginated } from "@/api/client";
import { resourceKeys } from "@/api/query-keys";
import { useOrgTimeZone } from "@/auth/use-org-timezone";
import { formatDateTime } from "@/shared/lib/datetime";
import { messageFrom } from "@/shared/lib/errors";
import {
  Button,
  Field,
  Input,
  ListLayout,
  ListSkeleton,
  PageHeader,
  Pagination,
  Select,
  Table,
  type Column,
} from "@/shared/ui";

const PAGE_SIZE = 50;
const auditKeys = resourceKeys("audit");

interface AuditLog {
  id: string;
  created_at: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  changes?: Record<string, unknown>;
  sequence_no?: number;
}

function listAudit(params: {
  page?: number;
  action?: string;
  entity_type?: string;
  entity_id?: string;
}): Promise<Paginated<AuditLog>> {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  search.set("page_size", String(PAGE_SIZE));
  if (params.action) search.set("action", params.action);
  if (params.entity_type) search.set("entity_type", params.entity_type);
  if (params.entity_id) search.set("entity_id", params.entity_id);
  return api.get(`/api/v1/audit/log/?${search}`);
}

export default function AuditLogPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const timeZone = useOrgTimeZone();
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const [action, setAction] = useState(searchParams.get("action") ?? "");
  const [entityType, setEntityType] = useState(searchParams.get("entity_type") ?? "");
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const query = useQuery({
    queryKey: auditKeys.list({ page, action, entityType }),
    queryFn: () =>
      listAudit({
        page,
        action: action || undefined,
        entity_type: entityType || undefined,
      }),
  });

  function setParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.push(`/audit?${params}`);
  }

  const columns: Column<AuditLog>[] = [
    {
      header: "When",
      cell: (r) => (timeZone ? formatDateTime(r.created_at, timeZone) : "—"),
    },
    { header: "Actor", cell: (r) => r.actor_id ?? "—" },
    { header: "Action", cell: (r) => r.action },
    { header: "Entity", cell: (r) => `${r.entity_type}${r.entity_id ? ` · ${r.entity_id.slice(0, 8)}` : ""}` },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Audit log"
        actions={
          <a href="/api/v1/audit/log/export/" download>
            <Button variant="secondary">Export</Button>
          </a>
        }
      />
      <p className="font-body text-sm text-cadence-ink/60">
        This log is <strong>append-only and hash-chained</strong>. It is{" "}
        <strong>never disposed of</strong>, even when a worker&apos;s personal record is destroyed.
      </p>
      <div className="flex flex-wrap gap-3">
        <Field label="Action" htmlFor="audit-action">
          <Input
            id="audit-action"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            onBlur={() => setParams({ action: action || null, page: "1" })}
            placeholder="e.g. pii_unmask"
          />
        </Field>
        <Field label="Entity type" htmlFor="audit-entity">
          <Input
            id="audit-entity"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            onBlur={() => setParams({ entity_type: entityType || null, page: "1" })}
          />
        </Field>
      </div>

      {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError ? (
        <p className="text-sm text-cadence-red">{messageFrom(query.error)}</p>
      ) : (
        <ListLayout stats={[{ value: query.data?.count ?? 0, label: "entries", tone: "ink" }]}>
          <Table
            columns={columns}
            rows={query.data?.results ?? []}
            rowKey={(r) => r.id}
            onRowClick={(r) => setSelected(r)}
            emptyMessage="No audit entries."
          />
          {query.data ? (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              count={query.data.count}
              onPageChange={(p) => setParams({ page: String(p) })}
            />
          ) : null}
        </ListLayout>
      )}

      {selected ? (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="mb-2 flex justify-between">
            <h2 className="font-subheading text-lg">Entry detail</h2>
            <button type="button" className="text-sm underline" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          <pre className="overflow-auto font-fine text-xs">{JSON.stringify(selected, null, 2)}</pre>
        </div>
      ) : null}
    </div>
  );
}
