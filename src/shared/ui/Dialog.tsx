"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/** Native modal. Title is exposed to assistive tech; Escape and backdrop
 * dismiss. Focus stays in the dialog while it is open. */
export function Dialog({ open, onClose, title, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={title ? titleId : undefined}
      aria-modal="true"
      onClose={onClose}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="dark-card m-auto w-[calc(100vw-2rem)] max-w-md rounded-[1.5rem] border-0 bg-card p-5 font-body text-on-card shadow-card backdrop:bg-cadence-ink/45 sm:rounded-[2rem] sm:p-6"
    >
      {title ? (
        <h2 id={titleId} className="mb-4 font-heading text-2xl text-on-card">
          {title}
        </h2>
      ) : null}
      {children}
    </dialog>
  );
}
