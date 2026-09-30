"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, type Paginated } from "@/api/client";
import { resourceKeys } from "@/api/query-keys";
import { PERM } from "@/permissions/keys";
import { applyFieldErrors } from "@/shared/lib/errors";
import { Button, Chip, Dialog, Field, Input, ListLayout, ListSkeleton, PageHeader, Pagination, PermGate, QueryError, Select, Table, Textarea, type Column, PageFrame, PageBody } from "@/shared/ui";

const PAGE_SIZE = 50;
const breachKeys = resourceKeys("privacy-breaches");

const breachSchema = z.object({
  description: z.string().trim().min(1, "Describe what happened."),
  personal_information: z.string().trim().min(1, "Say what personal information was involved."),
  rrosh: z.enum(["no_real_risk", "real_risk"]),
  discovered_on: z.string().min(1, "Enter the date it was discovered."),
  occurred_on: z.string().optional().or(z.literal("")),
  individuals_notified: z.boolean(),
  reported_to_commissioner: z.boolean(),
});
type BreachFormValues = z.infer<typeof breachSchema>;
const FIELD_NAMES = Object.keys(breachSchema.shape);

const emptyBreach = (): BreachFormValues => ({
  description: "",
  personal_information: "",
  rrosh: "no_real_risk",
  discovered_on: new Date().toISOString().slice(0, 10),
  occurred_on: "",
  individuals_notified: false,
  reported_to_commissioner: false,
});

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
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BreachFormValues>({
    resolver: zodResolver(breachSchema),
    defaultValues: emptyBreach(),
  });

  function closeDialog() {
    setOpen(false);
    setError(null);
    reset(emptyBreach());
  }

  // Records are write-once, so a double submit would file a duplicate for good;
  // isSubmitting disables the button and the guard below ignores re-entry.
  async function submit(values: BreachFormValues) {
    if (isSubmitting) return;
    setError(null);
    try {
      await api.post("/api/v1/privacy/breaches/", {
        ...values,
        occurred_on: values.occurred_on || null,
      });
      await queryClient.invalidateQueries({ queryKey: breachKeys.all });
      closeDialog();
    } catch (err) {
      const banner = applyFieldErrors(setFieldError, err, FIELD_NAMES);
      if (banner) setError(banner);
    }
  }

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
    <PageFrame>
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
      <PageBody>

        {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => query.refetch()} />
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

      <Dialog open={open} onClose={closeDialog} title="Record a breach">
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-3">
          <Field label="Description" htmlFor="br-desc" error={errors.description?.message}>
            <Textarea id="br-desc" {...register("description")} />
          </Field>
          <Field
            label="Personal information involved"
            htmlFor="br-pi"
            error={errors.personal_information?.message}
          >
            <Textarea id="br-pi" {...register("personal_information")} />
          </Field>
          <Field label="RROSH" htmlFor="br-rrosh" error={errors.rrosh?.message}>
            <Select id="br-rrosh" {...register("rrosh")}>
              <option value="no_real_risk">No real risk of significant harm</option>
              <option value="real_risk">Real risk of significant harm</option>
            </Select>
          </Field>
          <Field label="Discovered on" htmlFor="br-disc" error={errors.discovered_on?.message}>
            <Input id="br-disc" type="date" {...register("discovered_on")} />
          </Field>
          {error ? <p className="text-sm text-cadence-red">{error}</p> : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save record"}
          </Button>
        </form>
      </Dialog>
    </PageBody>
    </PageFrame>
  );
}
