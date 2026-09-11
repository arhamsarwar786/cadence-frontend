import { type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, forwardRef } from "react";
import { cn } from "@/shared/lib/cn";

const CONTROL_CLASSES =
  "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm font-body text-cadence-ink " +
  "placeholder:text-cadence-ink/40 focus:border-cadence-orange focus:outline-none focus:ring-2 focus:ring-cadence-orange/30 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

/** Label + control + error, the shape every form field takes (React Hook
 * Form drives validation; the server stays the real gate — ARCHITECTURE.md
 * §0). Errors surface from fieldErrorsFrom (shared/lib/errors.ts) or Zod. */
export function Field({ label, htmlFor, error, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="font-body text-sm font-medium text-cadence-ink">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-cadence-ink/60">{hint}</p> : null}
      {error ? <p className="text-xs text-cadence-red">{error}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(CONTROL_CLASSES, className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(CONTROL_CLASSES, className)} {...props}>
        {children}
      </select>
    );
  },
);
