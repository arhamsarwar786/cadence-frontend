import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

/** Fills the staff/portal main column without growing the document (use with locked shells). */
export function PageFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-4", className)}>{children}</div>
  );
}

/** Grows to absorb leftover height; pair with ListLayout or PageScrollRegion inside. */
export function PageBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>{children}</div>
  );
}

/** Scroll long detail/form content while headers and dock stay fixed. */
export function PageScrollRegion({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]",
        className,
      )}
    >
      {children}
    </div>
  );
}
