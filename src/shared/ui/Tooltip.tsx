"use client";

import type { ReactNode } from "react";
import {
  Tooltip as TooltipRoot,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/shared/lib/cn";

export type TooltipSide = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: TooltipSide;
  className?: string;
}

/** Cadence-themed shadcn/Radix tooltip. */
export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  return (
    <TooltipRoot>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex max-w-full", className)}>{children}</span>
      </TooltipTrigger>
      <TooltipContent side={side}>{content}</TooltipContent>
    </TooltipRoot>
  );
}
