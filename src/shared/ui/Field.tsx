"use client";

import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  forwardRef,
} from "react";
import { cn } from "@/shared/lib/cn";
import { Tooltip } from "@/shared/ui/Tooltip";

const CONTROL_CLASSES =
  "h-10 w-full rounded-full border border-cadence-ink/10 bg-surface px-4 text-sm font-body text-cadence-ink " +
  "placeholder:text-cadence-ink/50 focus:border-cadence-orange focus:outline-none focus:ring-2 focus:ring-cadence-yellow/50 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const TEXTAREA_CLASSES =
  "min-h-24 w-full rounded-2xl border border-cadence-ink/10 bg-surface px-4 py-3 text-sm font-body text-cadence-ink " +
  "placeholder:text-cadence-ink/50 focus:border-cadence-orange focus:outline-none focus:ring-2 focus:ring-cadence-yellow/50 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  tooltip?: string;
  children: ReactNode;
}

/** Label + control + error, the shape every form field takes (React Hook
 * Form drives validation; the server stays the real gate — ARCHITECTURE.md
 * §0). Errors surface from fieldErrorsFrom (shared/lib/errors.ts) or Zod. */
export function Field({ label, htmlFor, error, hint, tooltip, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5">
        <label htmlFor={htmlFor} className="font-body text-sm font-medium text-current/80">
          {label}
        </label>
        {tooltip ? (
          <Tooltip content={tooltip} side="bottom">
            <button
              type="button"
              className="flex h-4 w-4 items-center justify-center rounded-full bg-cadence-yellow/80 font-fine text-[9px] text-cadence-ink"
              aria-label={tooltip}
            >
              i
            </button>
          </Tooltip>
        ) : null}
      </span>
      {children}
      {hint && !error ? <p className="text-xs text-current/65">{hint}</p> : null}
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

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(TEXTAREA_CLASSES, className)} {...props} />;
  },
);
