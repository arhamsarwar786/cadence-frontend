"use client";

import { cn } from "@/shared/lib/cn";
import type { ReactNode } from "react";

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: ReactNode;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
  dark,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
  dark?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)} role="tablist">
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-fine text-[10px] uppercase tracking-wide transition-colors",
              dark
                ? active
                  ? "bg-cadence-yellow text-cadence-ink"
                  : "bg-white/5 text-on-card-muted hover:bg-white/10 hover:text-on-card"
                : active
                  ? "bg-cadence-yellow text-cadence-ink"
                  : "bg-surface-muted text-cadence-ink/55 hover:text-cadence-ink",
            )}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
