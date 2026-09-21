import { cn } from "@/shared/lib/cn";

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

/** Pulse row skeletons for table / pick-list loading states. */
export function TableSkeleton({ rows = 6, columns = 4, className }: TableSkeletonProps) {
  return (
    <div
      className={cn("overflow-hidden rounded-xl border border-border bg-surface", className)}
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading table</span>
      <div className="motion-safe:animate-pulse">
        <div className="flex gap-3 border-b border-border px-3 py-2.5">
          {Array.from({ length: columns }, (_, index) => (
            <div
              key={`h-${index}`}
              className="h-2.5 flex-1 rounded-full bg-cadence-ink/10"
              style={{ maxWidth: index === 0 ? "8rem" : undefined }}
            />
          ))}
        </div>
        {Array.from({ length: rows }, (_, row) => (
          <div
            key={row}
            className="flex items-center gap-3 border-t border-border px-3 py-3.5"
          >
            {Array.from({ length: columns }, (_, col) => (
              <div
                key={col}
                className={cn(
                  "h-3.5 rounded-full bg-cadence-ink/8",
                  col === 0 ? "w-1/4 min-w-[6rem]" : "flex-1",
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
