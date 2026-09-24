import { cn } from "@/shared/lib/cn";
import type { ButtonHTMLAttributes } from "react";

export function Fab({
  className,
  label = "Add",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-full bg-cadence-yellow text-2xl leading-none text-on-accent shadow-card transition hover:brightness-95 disabled:opacity-50",
        className,
      )}
      {...props}
    >
      +
    </button>
  );
}
