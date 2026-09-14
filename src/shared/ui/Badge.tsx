"use client";

import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { Tooltip } from "@/shared/ui/Tooltip";

const TONE_CLASSES = {
  neutral: "bg-[#e8dfc2] text-cadence-ink",
  positive: "bg-cadence-lime text-cadence-ink",
  warning: "bg-cadence-yellow text-cadence-ink",
  negative: "bg-cadence-red text-white",
  info: "bg-cadence-orange text-cadence-ink",
} as const;

export type BadgeTone = keyof typeof TONE_CLASSES;

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  tooltip?: string;
}

/**
 * A generic tone-only badge. Feature status badges wrap this and map their
 * own closed enum to a tone — this component never computes the next status
 * (ARCHITECTURE.md §8 folder rules).
 */
export function Badge({ children, tone = "neutral", className, tooltip }: BadgeProps) {
  const badge = (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium font-body tracking-wide",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
  return tooltip ? <Tooltip content={tooltip}>{badge}</Tooltip> : badge;
}
