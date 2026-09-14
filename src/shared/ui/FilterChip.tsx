import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full px-3 py-1.5 font-body text-xs font-medium capitalize transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cadence-yellow",
        active
          ? "bg-cadence-yellow text-cadence-ink hover:bg-[#e8cc62]"
          : "bg-card text-on-card hover:bg-card-muted",
      )}
    >
      {children}
    </button>
  );
}
