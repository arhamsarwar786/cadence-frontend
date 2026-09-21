import { cn } from "@/shared/lib/cn";
import type { ReactNode } from "react";

export function Chip({
  children,
  className,
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "yellow" | "muted" | "success" | "danger";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 font-fine text-[10px] uppercase tracking-wide",
        tone === "default" && "bg-surface-muted text-cadence-ink/70",
        tone === "yellow" && "bg-cadence-yellow text-cadence-ink",
        tone === "muted" && "bg-cadence-ink/8 text-cadence-ink/55",
        tone === "success" && "bg-cadence-lime/40 text-cadence-ink",
        tone === "danger" && "bg-cadence-red/15 text-cadence-red",
        className,
      )}
    >
      {children}
    </span>
  );
}
