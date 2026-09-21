import { cn } from "@/shared/lib/cn";

export interface ListSkeletonProps {
  rows?: number;
  className?: string;
}

export function ListSkeleton({ rows = 6, className }: ListSkeletonProps) {
  return (
    <div
      className={cn(
        "motion-safe:animate-pulse rounded-[2rem] bg-card p-5 shadow-card",
        className,
      )}
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading list</span>
      <div className="mb-4 h-2.5 w-28 rounded-full bg-white/10" />
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="border-t border-white/5 py-3.5">
          <div className="h-3.5 w-2/3 max-w-xs rounded-full bg-white/10" />
        </div>
      ))}
    </div>
  );
}
