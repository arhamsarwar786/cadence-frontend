import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { Tooltip } from "@/shared/ui/Tooltip";

export interface StatItem {
  value: string | number;
  label?: string;
  tone?: "ink" | "orange" | "lime" | "muted";
}

const TONE_CLASS: Record<NonNullable<StatItem["tone"]>, string> = {
  ink: "text-cadence-ink",
  orange: "text-cadence-orange",
  lime: "text-cadence-lime",
  muted: "text-cadence-ink/55",
};

export function StatRail({ stats }: { stats: StatItem[] }) {
  if (stats.length === 0) return null;
  return (
    <aside className="hidden w-24 shrink-0 flex-col gap-6 pt-2 sm:flex">
      {stats.map((stat, index) => (
        <div key={`${stat.value}-${index}`}>
          {stat.label ? (
            <Tooltip content={stat.label}>
              <p
                className={cn(
                  "font-heading text-4xl leading-none",
                  TONE_CLASS[stat.tone ?? (index === 0 ? "ink" : "muted")],
                )}
              >
                {stat.value}
              </p>
            </Tooltip>
          ) : (
            <p
              className={cn(
                "font-heading text-4xl leading-none",
                TONE_CLASS[stat.tone ?? (index === 0 ? "ink" : "muted")],
              )}
            >
              {stat.value}
            </p>
          )}
          {stat.label ? (
            <p className="mt-1 font-fine text-[10px] uppercase tracking-wide text-cadence-ink/60">
              {stat.label}
            </p>
          ) : null}
        </div>
      ))}
    </aside>
  );
}

export function ListLayout({
  stats,
  children,
}: {
  stats?: StatItem[];
  children: ReactNode;
}) {
  return (
    <div className="flex gap-6">
      {stats ? <StatRail stats={stats} /> : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function PageHeader({
  title,
  actions,
}: {
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-heading text-3xl text-cadence-ink">{title}</h1>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
