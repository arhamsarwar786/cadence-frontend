"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/shared/lib/cn";
import { Tooltip } from "@/shared/ui/Tooltip";

const VARIANT_CLASSES = {
  primary:
    "bg-cadence-yellow text-cadence-ink hover:bg-cadence-yellow/90 focus-visible:outline-cadence-yellow",
  secondary:
    "bg-transparent text-inherit border border-current/20 hover:bg-current/5 focus-visible:outline-current",
  ghost: "bg-transparent text-inherit hover:bg-current/5 focus-visible:outline-current",
  danger: "bg-cadence-red text-white hover:bg-cadence-red/90 focus-visible:outline-cadence-red",
  inverse:
    "bg-cadence-yellow text-cadence-ink hover:bg-cadence-yellow/90 focus-visible:outline-cadence-yellow",
} as const;

const SIZE_CLASSES = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANT_CLASSES;
  size?: keyof typeof SIZE_CLASSES;
  /** Themed hover tip. Prefer this over native `title`. */
  tooltip?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", type = "button", tooltip, title, ...props },
  ref,
) {
  const tip = tooltip ?? title;
  const button = (
    <button
      ref={ref}
      type={type}
      title={tip ? undefined : title}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium font-body transition-colors",
        "disabled:pointer-events-none disabled:opacity-50",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    />
  );
  if (!tip) return button;
  return (
    <Tooltip content={tip} className={className?.includes("w-full") ? "w-full" : undefined}>
      {button}
    </Tooltip>
  );
});
