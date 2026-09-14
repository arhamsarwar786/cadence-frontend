"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Button } from "@/shared/ui/Button";
import { Dialog } from "@/shared/ui/Dialog";

export interface ConfirmOptions {
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
}

/**
 * Replaces window.confirm for destructive office acts. The caller awaits
 * a boolean; nothing is submitted until the person confirms.
 */
export function useConfirm() {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(
    null,
  );
  const [pending, setPending] = useState(false);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, resolve });
    });
  }, []);

  function close(ok: boolean) {
    state?.resolve(ok);
    setState(null);
    setPending(false);
  }

  const dialog: ReactNode = state ? (
    <Dialog open onClose={() => close(false)} title={state.title}>
      <p className="mb-5 font-body text-sm text-on-card-muted">{state.body}</p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => close(false)} disabled={pending}>
          Cancel
        </Button>
        <Button
          type="button"
          variant={state.danger ? "danger" : "primary"}
          disabled={pending}
          onClick={() => close(true)}
        >
          {state.confirmLabel ?? "Confirm"}
        </Button>
      </div>
    </Dialog>
  ) : null;

  return { confirm, dialog, pending, setPending };
}
