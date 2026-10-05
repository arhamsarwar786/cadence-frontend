"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/shared/lib/cn";
import { Tooltip } from "@/shared/ui/Tooltip";

const VARIANT_CLASSES = {
  primary:
    "bg-[linear-gradient(100deg,#B5232E_0%,#D24C2C_34%,#EE7A2E_70%,#F4963A_100%)] text-white shadow-[0_12px_28px_-10px_rgba(181,35,46,0.6),inset_0_1px_0_rgba(255,255,255,0.35)] hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-10px_rgba(181,35,46,0.7),inset_0_1px_0_rgba(255,255,255,0.4)] hover:brightness-[1.04] active:translate-y-0 active:brightness-95 focus-visible:outline-cadence-orange",
  secondary:
    "bg-transparent text-inherit border border-current/20 hover:bg-current/5 focus-visible:outline-current",
  ghost: "bg-transparent text-inherit hover:bg-current/5 focus-visible:outline-current",
  danger: "bg-cadence-red text-white hover:bg-cadence-red/90 focus-visible:outline-cadence-red",
  inverse:
    "bg-cadence-yellow text-on-accent hover:bg-cadence-yellow/90 focus-visible:outline-cadence-yellow",
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
        "inline-flex items-center justify-center gap-2 rounded-full font-body font-semibold transition-all duration-200",
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
