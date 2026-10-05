import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { BackButton } from "@/shared/ui/BackButton";
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
    <div className="flex min-h-0 flex-1 gap-6">
      {stats ? <StatRail stats={stats} /> : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Flex column so a Table can shrink to the space left and scroll its own
         * rows; anything taller than that still scrolls here as a fallback. */}
        <div className="list-layout-body flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
          {children}
        </div>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  actions,
  meta,
}: {
  title: ReactNode;
  actions?: ReactNode;
  /** Optional row under the title — status badges, subtitle, etc. */
  meta?: ReactNode;
}) {
  return (
    // Not sticky: <main> is overflow-hidden, so sticky pinned the header below
    // main's top padding. The negative top margin cancels that padding instead.
    <header className="z-30 -mx-4 -mt-5 mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-cadence-ink/10 bg-[rgba(246,239,217,0.78)] px-4 py-3 backdrop-blur-xl sm:-mx-8 sm:-mt-6 sm:px-8">
      {/* basis-48: on a phone, actions that don't fit beside the title wrap below it. */}
      <div className="flex min-w-0 flex-1 basis-48 items-center gap-3">
        <BackButton />
        <div className="min-w-0">
          <h1 className="font-heading text-2xl leading-tight text-cadence-ink sm:text-3xl">{title}</h1>
          {meta ? <div className="mt-1 flex flex-wrap items-center gap-2">{meta}</div> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
