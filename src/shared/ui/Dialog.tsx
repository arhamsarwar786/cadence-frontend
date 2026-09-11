"use client";

import { useEffect, useRef, type ReactNode } from "react";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/** The native <dialog> element — no modal library needed for a first
 * scaffold (ARCHITECTURE.md §10: no separate design-system package). */
export function Dialog({ open, onClose, title, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="w-full max-w-lg rounded-lg border border-border bg-surface p-6 font-body text-cadence-ink backdrop:bg-cadence-ink/40"
    >
      {title ? <h2 className="mb-4 font-heading text-xl">{title}</h2> : null}
      {children}
    </dialog>
  );
}
