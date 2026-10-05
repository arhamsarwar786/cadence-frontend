import { cn } from "@/shared/lib/cn";

export interface LoadingProps {
  /** Accessible name announced to screen readers (visible text is always "Loading…"). */
  label?: string;
  /** Fill the viewport (route-level / auth gates). */
  fullScreen?: boolean;
  className?: string;
}

/** Full Cadence lockup, pulsing — the single loading indicator used across the app.
 * Copy inherits the surrounding text colour so it reads on cream and charcoal
 * alike; on charcoal the lockup's dark strokes sit on a cream tile. */
export function Loading({ label = "Loading", fullScreen = false, className }: LoadingProps) {
  return (
    <div
      role="status"
      aria-label={label}
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "flex flex-col items-center justify-center gap-3",
        fullScreen ? "min-h-dvh" : "w-full py-10",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/lockup.png"
        alt=""
        className={cn(
          "w-auto object-contain motion-safe:animate-pulse",
          "in-[.bg-card]:rounded-2xl in-[.bg-card]:bg-surface in-[.bg-card]:p-2",
          "in-[.dark-card]:rounded-2xl in-[.dark-card]:bg-surface in-[.dark-card]:p-2",
          fullScreen ? "h-28" : "h-20",
        )}
      />
      <span aria-hidden="true" className="font-body text-sm text-current/70">
        Loading…
      </span>
    </div>
  );
}
