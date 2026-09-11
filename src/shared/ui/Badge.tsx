import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

const TONE_CLASSES = {
  neutral: "bg-surface-muted text-cadence-ink",
  positive: "bg-emerald-100 text-emerald-800",
  warning: "bg-cadence-yellow/60 text-cadence-ink",
  negative: "bg-cadence-red/10 text-cadence-red",
  info: "bg-cadence-orange/15 text-cadence-orange",
} as const;

export type BadgeTone = keyof typeof TONE_CLASSES;

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}

/**
 * A generic tone-only badge. Feature status badges (e.g. ClientStatusBadge)
 * wrap this and map their own closed enum (status-labels.ts) to a tone —
 * this component never computes the next status, only renders the one it's
 * given (ARCHITECTURE.md §8 folder rules).
 */
export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium font-body",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
