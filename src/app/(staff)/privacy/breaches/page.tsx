"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, type Paginated } from "@/api/client";
import { resourceKeys } from "@/api/query-keys";
import { PERM } from "@/permissions/keys";
import { messageFrom } from "@/shared/lib/errors";
import {
  Button,
  Chip,
  Dialog,
  Field,
  Input,
  ListLayout,
  ListSkeleton,
  PageHeader,
  Pagination,
  PermGate,
  Select,
  Table,
  Textarea,
  type Column,
} from "@/shared/ui";

const PAGE_SIZE = 50;
const breachKeys = resourceKeys("privacy-breaches");

interface PrivacyBreach {
  id: string;
  discovered_on: string;
  occurred_on: string | null;
  description: string;
  personal_information: string;
  rrosh: string;
  individuals_notified: boolean;
  reported_to_commissioner: boolean;
  retention_until: string;
  created_at: string;
}

export default function BreachRegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    description: "",
    personal_information: "",
    rrosh: "no_real_risk",
    discovered_on: new Date().toISOString().slice(0, 10),
    occurred_on: "",
    individuals_notified: false,
    reported_to_commissioner: false,
  });

  const query = useQuery({
    queryKey: breachKeys.list({ page }),
    queryFn: () =>
      api.get<Paginated<PrivacyBreach>>(
        `/api/v1/privacy/breaches/?page=${page}&page_size=${PAGE_SIZE}`,
      ),
  });

  const columns: Column<PrivacyBreach>[] = [
    { header: "Discovered", cell: (b) => b.discovered_on },
    {
      header: "RROSH",
      cell: (b) => (
        <Chip tone={b.rrosh === "real_risk" ? "danger" : "muted"}>
          {b.rrosh === "real_risk" ? "Real risk" : "No real risk"}
        </Chip>
      ),
    },
    {
      header: "Description",
      cell: (b) => <span className="line-clamp-2 max-w-md">{b.description}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Breach register"
        actions={
          <PermGate anyOf={PERM.PRIVACY_BREACHES_MANAGE}>
            <Button onClick={() => setOpen(true)}>Record breach</Button>
          </PermGate>
        }
      />
      <p className="font-body text-sm text-cadence-ink/60">
        Breach records are write-once — there is no edit or close door.
      </p>
      {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError ? (
        <p className="text-sm text-cadence-red">{messageFrom(query.error)}</p>
      ) : (
        <ListLayout stats={[{ value: query.data?.count ?? 0, label: "breaches", tone: "ink" }]}>
          <Table
            columns={columns}
            rows={query.data?.results ?? []}
            rowKey={(b) => b.id}
            onRowClick={(b) => router.push(`/privacy/breaches/${b.id}`)}
            emptyMessage="No breaches recorded."
          />
          {query.data ? (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              count={query.data.count}
              onPageChange={(p) => router.push(`/privacy/breaches?page=${p}`)}
            />
          ) : null}
        </ListLayout>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Record a breach">
        <div className="flex flex-col gap-3">
          <Field label="Description" htmlFor="br-desc">
            <Textarea
              id="br-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <Field label="Personal information involved" htmlFor="br-pi">
            <Textarea
              id="br-pi"
              value={form.personal_information}
              onChange={(e) => setForm({ ...form, personal_information: e.target.value })}
            />
          </Field>
          <Field label="RROSH" htmlFor="br-rrosh">
            <Select
              id="br-rrosh"
              value={form.rrosh}
              onChange={(e) => setForm({ ...form, rrosh: e.target.value })}
            >
              <option value="no_real_risk">No real risk of significant harm</option>
              <option value="real_risk">Real risk of significant harm</option>
            </Select>
          </Field>
          <Field label="Discovered on" htmlFor="br-disc">
            <Input
              id="br-disc"
              type="date"
              value={form.discovered_on}
              onChange={(e) => setForm({ ...form, discovered_on: e.target.value })}
            />
          </Field>
          {error ? <p className="text-sm text-cadence-red">{error}</p> : null}
          <Button
            onClick={async () => {
              setError(null);
              try {
                await api.post("/api/v1/privacy/breaches/", {
                  description: form.description,
                  personal_information: form.personal_information,
                  rrosh: form.rrosh,
                  discovered_on: form.discovered_on || undefined,
                  occurred_on: form.occurred_on || null,
                  individuals_notified: form.individuals_notified,
                  reported_to_commissioner: form.reported_to_commissioner,
                });
                await queryClient.invalidateQueries({ queryKey: breachKeys.all });
                setOpen(false);
              } catch (err) {
                setError(messageFrom(err));
              }
            }}
          >
            Save record
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
