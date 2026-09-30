import { cn } from "@/shared/lib/cn";

export interface LoadingProps {
  /** Accessible name announced to screen readers (visible text is always "Loading…"). */
  label?: string;
  /** Fill the viewport (route-level / auth gates). */
  fullScreen?: boolean;
  className?: string;
}

/** Cadence mark, pulsing — the single loading indicator used across the app. */
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
        src="/brand/mark-full.png"
        alt=""
        className="h-12 w-auto object-contain motion-safe:animate-pulse"
      />
      <span aria-hidden="true" className="font-body text-sm text-cadence-ink/70">
        Loading…
      </span>
    </div>
  );
}
