"use client";

import { cn } from "@/shared/lib/cn";

export interface PDFViewerProps {
  src: string;
  title?: string;
  className?: string;
}

/** Minimal same-origin PDF embed. Auth cookies ride the browser request. */
export function PDFViewer({ src, title = "PDF document", className }: PDFViewerProps) {
  if (!src) {
    return (
      <p className="rounded-xl border border-border bg-surface-muted px-4 py-8 text-center font-body text-sm text-cadence-ink/60">
        No document to display.
      </p>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-surface", className)}>
      <iframe title={title} src={src} className="h-[min(70vh,40rem)] w-full" />
      <div className="flex justify-end border-t border-border px-3 py-2">
        <a
          href={src}
          download
          target="_blank"
          rel="noreferrer"
          className="font-body text-xs text-cadence-ink/70 underline hover:text-cadence-ink"
        >
          Open / download
        </a>
      </div>
    </div>
  );
}
