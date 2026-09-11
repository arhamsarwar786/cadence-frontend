import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/shared/lib/cn";

const VARIANT_CLASSES = {
  primary: "bg-cadence-red text-white hover:bg-cadence-red/90 focus-visible:outline-cadence-red",
  secondary:
    "bg-transparent text-cadence-ink border border-border hover:bg-surface-muted focus-visible:outline-cadence-ink",
  ghost: "bg-transparent text-cadence-ink hover:bg-surface-muted focus-visible:outline-cadence-ink",
  danger: "bg-cadence-red text-white hover:bg-cadence-red/90 focus-visible:outline-cadence-red",
} as const;

const SIZE_CLASSES = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANT_CLASSES;
  size?: keyof typeof SIZE_CLASSES;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium font-body transition-colors",
        "disabled:pointer-events-none disabled:opacity-50",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    />
  );
});
