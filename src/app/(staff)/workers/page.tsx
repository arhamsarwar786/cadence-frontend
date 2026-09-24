"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LifecycleStatusBadge } from "@/features/workers/components/LifecycleStatusBadge";
import {
  listSkillsCatalog,
  listWorkers,
  searchWorkers,
  workerKeys,
} from "@/features/workers/api";
import type { EmployeeList } from "@/features/workers/types";
import { PERM } from "@/permissions/keys";
import { messageFrom } from "@/shared/lib/errors";
import { matchesQuery } from "@/shared/lib/matches";
import { isActiveEmployee } from "@/features/workers/lifecycle";
import type { LifecycleStatus } from "@/shared/lib/status-labels";
import {
  Avatar,
  Button,
  Chip,
  Field,
  Input,
  ListLayout,
  ListSkeleton,
  PageBody,
  PageFrame,
  PageHeader,
  Pagination,
  PermGate,
  SearchField,
  Select,
  Table,
  type Column,
} from "@/shared/ui";

const PAGE_SIZE = 50;
const FIND_WINDOW = 200;

export default function WorkersListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const q = searchParams.get("q") ?? "";
  const skill = searchParams.get("skill") ?? "";
  const cert = searchParams.get("cert") ?? "";
  const minYears = searchParams.get("minYears") ?? "";
  const availableOn = searchParams.get("availableOn") ?? "";
  const availableAt = searchParams.get("availableAt") ?? "";
  const finding = q.trim().length > 0;
  const filtersActive = Boolean(skill || cert || minYears || availableOn || availableAt);
  const [filtersOpen, setFiltersOpen] = useState(filtersActive);

  const skillsCatalog = useQuery({
    queryKey: ["skills-catalog"],
    queryFn: listSkillsCatalog,
    enabled: filtersOpen || filtersActive,
  });

  const searchFilterParams = {
    page,
    pageSize: PAGE_SIZE,
    skill: skill || undefined,
    cert: cert || undefined,
    minYears: minYears ? Number(minYears) : undefined,
    availableOn: availableOn || undefined,
    availableAt: availableAt || undefined,
  };

  const query = useQuery({
    queryKey: filtersActive
      ? ["workers-search", searchFilterParams]
      : workerKeys.list({ page: finding ? 1 : page, find: finding }),
    queryFn: () =>
      filtersActive
        ? searchWorkers(searchFilterParams)
        : listWorkers({
            page: finding ? 1 : page,
            pageSize: finding ? FIND_WINDOW : PAGE_SIZE,
          }),
  });

  const rows = useMemo(() => {
    const results = query.data?.results ?? [];
    if (!finding) return results;
    return results.filter((worker) =>
      matchesQuery(
        `${worker.first_name} ${worker.last_name} ${worker.email ?? ""} ${worker.phone ?? ""}`,
        q,
      ),
    );
  }, [finding, q, query.data?.results]);

  const showRating = rows.some((w) => "rating" in w);

  function setParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`/workers?${params.toString()}`);
  }

  const columns: Column<EmployeeList>[] = useMemo(() => {
    const cols: Column<EmployeeList>[] = [
      {
        header: "Name",
        cell: (w) => {
          const name = `${w.first_name} ${w.last_name}`;
          return (
            <span className="flex items-center gap-2">
              <Avatar name={name} size="sm" />
              <span>
                <span className="block font-medium">{name}</span>
                <LifecycleStatusBadge status={w.lifecycle_status as LifecycleStatus} />
              </span>
            </span>
          );
        },
      },
      { header: "Phone", cell: (w) => w.phone ?? "—", className: "hidden sm:table-cell" },
      { header: "Email", cell: (w) => w.email ?? "—", className: "hidden md:table-cell" },
      {
        header: "Status",
        className: "hidden sm:table-cell",
        cell: (w) =>
          isActiveEmployee(w.lifecycle_status) &&
          "work_status" in w &&
          w.work_status ? (
            <Chip tone="muted">{String(w.work_status).replaceAll("_", " ")}</Chip>
          ) : (
            "—"
          ),
      },
    ];
    if (showRating) {
      cols.push({
        header: "Rating",
        className: "hidden lg:table-cell",
        cell: (w) => ("rating" in w && w.rating != null ? `★ ${w.rating}` : "—"),
      });
    }
    return cols;
  }, [showRating]);

  const showPagination = filtersActive || !finding;

  return (
    <PageFrame>
      <PageHeader
        title="Workers"
        actions={
          <PermGate anyOf={PERM.WORKERS_CREATE}>
            <Link href="/workers/new">
              <Button>New worker</Button>
            </Link>
          </PermGate>
        }
      />
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1">
          <SearchField
            value={q}
            onChange={(next) => setParams({ q: next || null, page: "1" })}
            placeholder="Find by name, email, or phone"
            label="Find workers"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setFiltersOpen((v) => !v)}
        >
          {filtersOpen ? "Hide filters" : "Filters"}
        </Button>
      </div>

      {filtersOpen ? (
        <div className="grid gap-3 rounded-xl border border-border bg-surface p-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Skill" htmlFor="workers-skill">
            <Select
              id="workers-skill"
              value={skill}
              onChange={(e) => setParams({ skill: e.target.value || null, page: "1" })}
            >
              <option value="">Any</option>
              {(skillsCatalog.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Min years (with skill)" htmlFor="workers-years">
            <Input
              id="workers-years"
              type="number"
              min={0}
              value={minYears}
              onChange={(e) => setParams({ minYears: e.target.value || null, page: "1" })}
            />
          </Field>
          <Field label="Certification name" htmlFor="workers-cert">
            <Input
              id="workers-cert"
              value={cert}
              onChange={(e) => setParams({ cert: e.target.value || null, page: "1" })}
              placeholder="e.g. Forklift"
            />
          </Field>
          <p className="col-span-full font-body text-xs text-cadence-ink/55">
            Date/time availability filters apply to active employees the office can book.
          </p>
          <Field label="Available on" htmlFor="workers-on">
            <Input
              id="workers-on"
              type="date"
              value={availableOn}
              onChange={(e) => setParams({ availableOn: e.target.value || null, page: "1" })}
            />
          </Field>
          <Field label="Available at" htmlFor="workers-at">
            <Input
              id="workers-at"
              type="time"
              value={availableAt}
              onChange={(e) => setParams({ availableAt: e.target.value || null, page: "1" })}
            />
          </Field>
        </div>
      ) : null}

      <PageBody>
        {query.isLoading ? (
          <ListSkeleton />
        ) : query.isError ? (
          <p className="font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>
        ) : (
          <ListLayout
          stats={[
            {
              value: finding && !filtersActive ? rows.length : (query.data?.count ?? 0),
              label: finding || filtersActive ? "matches" : "employees",
              tone: "ink",
            },
          ]}
        >
          <div className="flex flex-col gap-4">
            {finding && !filtersActive && (query.data?.count ?? 0) > FIND_WINDOW ? (
              <p className="font-body text-xs text-cadence-ink/60">
                Showing matches in the first {FIND_WINDOW} of {query.data?.count} workers.
              </p>
            ) : null}
            <Table
              columns={columns}
              rows={rows}
              rowKey={(w) => w.id}
              onRowClick={(w) => router.push(`/workers/${w.id}`)}
              emptyMessage={
                finding || filtersActive
                  ? "No workers match those filters."
                  : "No workers yet."
              }
            />
            {showPagination && query.data ? (
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
      </PageBody>
    </PageFrame>
  );
}
