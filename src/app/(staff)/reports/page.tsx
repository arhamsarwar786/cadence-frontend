"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { getReportsDashboard, reportKeys } from "@/features/money/api";
import { messageFrom } from "@/shared/lib/errors";
import { formatMoney } from "@/shared/lib/money";
import { PageHeader } from "@/shared/ui";

export default function ReportsPage() {
  const query = useQuery({
    queryKey: reportKeys.detail("dashboard"),
    queryFn: getReportsDashboard,
  });

  if (query.isLoading) return <p className="text-sm text-cadence-ink/60">Loading…</p>;
  if (query.isError) return <p className="text-sm text-cadence-red">{messageFrom(query.error)}</p>;
  const data = query.data;
  if (!data) return null;

  const fill = data.fill_rate;
  const unbilled = data.unbilled_hours;
  const overdue = data.overdue_invoices;
  const margins = data.margin_by_client;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Reports" />

      <section className="rounded-[1.5rem] bg-surface p-6">
        <h2 className="font-subheading text-sm uppercase tracking-wide text-cadence-ink/50">Fill rate</h2>
        <p className="mt-2 font-heading text-4xl">
          {fill?.fill_rate != null ? `${Math.round(Number(fill.fill_rate) * 100)}%` : "—"}
        </p>
        <p className="mt-1 text-sm text-cadence-ink/55">
          {fill?.headcount_filled ?? 0} filled of {fill?.headcount_needed ?? 0} needed across{" "}
          {fill?.jobs_count ?? 0} jobs
        </p>
      </section>

      <section className="rounded-[1.5rem] bg-surface p-6">
        <h2 className="font-subheading text-sm uppercase tracking-wide text-cadence-ink/50">
          Unbilled hours
        </h2>
        <p className="mt-2 font-heading text-4xl text-cadence-orange">
          {unbilled?.unbilled_hours ?? "—"}
        </p>
        <p className="mt-1 text-sm text-cadence-ink/55">
          Worked {unbilled?.worked_hours ?? "—"} · Billed {unbilled?.billed_hours ?? "—"}
        </p>
        <Link href="/invoices/new" className="mt-3 inline-block text-sm underline">
          Create invoice from unbilled work
        </Link>
      </section>

      <section>
        <h2 className="mb-3 font-subheading text-sm uppercase tracking-wide text-cadence-ink/50">
          Overdue invoices
        </h2>
        <p className="mb-3 text-sm text-cadence-ink/60">
          {overdue?.count ?? 0} invoices ·{" "}
          {overdue && "total" in overdue && overdue.total != null
            ? formatMoney(overdue.total)
            : "—"}
        </p>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {(overdue?.invoices ?? []).map((inv) => (
            <li key={inv.id}>
              <Link
                href={`/invoices/${inv.id}`}
                className="flex justify-between px-4 py-3 text-sm hover:bg-surface"
              >
                <span>
                  {inv.client_name} · {inv.invoice_number}
                </span>
                <span>
                  due {inv.due_date}
                  {"total" in inv && inv.total != null ? ` · ${formatMoney(inv.total)}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 font-subheading text-sm uppercase tracking-wide text-cadence-ink/50">
          Margin by client
        </h2>
        {margins &&
        "excluded_links_no_margin_grant" in margins &&
        Number(margins.excluded_links_no_margin_grant) > 0 ? (
          <p className="mb-3 text-sm text-cadence-ink/55">
            {margins.excluded_links_no_margin_grant} clients hidden — you don&apos;t have permission
            to see margin.
          </p>
        ) : null}
        <ul className="divide-y divide-border rounded-lg border border-border">
          {margins.rows.map((row) => (
            <li key={row.client_id} className="flex justify-between px-4 py-3 text-sm">
              <span>{row.client_name}</span>
              <span>
                billed {"billed" in row && row.billed != null ? formatMoney(row.billed) : "—"} ·
                margin {row.margin == null ? "—" : formatMoney(row.margin)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
