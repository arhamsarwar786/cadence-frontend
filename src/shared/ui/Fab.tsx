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
        "flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(100deg,#B5232E_0%,#D24C2C_34%,#EE7A2E_70%,#F4963A_100%)] text-2xl leading-none text-white shadow-[0_12px_28px_-10px_rgba(181,35,46,0.6),inset_0_1px_0_rgba(255,255,255,0.35)] transition-all hover:-translate-y-0.5 hover:brightness-[1.04] active:translate-y-0 active:brightness-95 disabled:opacity-50",
        className,
      )}
      {...props}
    >
      +
    </button>
  );
}
