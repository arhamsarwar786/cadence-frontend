import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { Tooltip } from "@/shared/ui/Tooltip";

export interface StatItem {
  value: string | number;
  label?: string;
  /** Accent is a colored mark only — numbers stay ink for contrast on cream. */
  tone?: "ink" | "orange" | "lime" | "muted";
}

const TONE_MARK: Record<NonNullable<StatItem["tone"]>, string> = {
  ink: "bg-cadence-ink",
  orange: "bg-cadence-orange",
  lime: "bg-cadence-lime",
  muted: "bg-cadence-ink/35",
};

const TONE_VALUE: Record<NonNullable<StatItem["tone"]>, string> = {
  ink: "text-cadence-ink",
  orange: "text-cadence-ink",
  lime: "text-cadence-ink",
  muted: "text-cadence-ink/70",
};

export function StatRail({ stats }: { stats: StatItem[] }) {
  if (stats.length === 0) return null;
  return (
    <aside className="hidden w-24 shrink-0 flex-col gap-6 pt-2 sm:flex">
      {stats.map((stat, index) => {
        const tone = stat.tone ?? (index === 0 ? "ink" : "muted");
        const value = (
          <p className={cn("font-heading text-4xl leading-none", TONE_VALUE[tone])}>
            <span
              aria-hidden
              className={cn("mb-1.5 block h-1 w-6 rounded-full", TONE_MARK[tone])}
            />
            {stat.value}
          </p>
        );
        return (
          <div key={`${stat.value}-${index}`}>
            {stat.label ? <Tooltip content={stat.label}>{value}</Tooltip> : value}
            {stat.label ? (
              <p className="mt-1 font-fine text-[10px] uppercase tracking-wide text-cadence-ink/60">
                {stat.label}
              </p>
            ) : null}
          </div>
        );
      })}
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
