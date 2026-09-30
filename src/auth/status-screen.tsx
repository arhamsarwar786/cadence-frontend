"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useSession } from "@/auth/session-context";
import { BrandLockup, Button, Tooltip } from "@/shared/ui";

/** Full-viewport cream canvas so a missing API never leaves a blank page. */
export function StatusScreen({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <BrandLockup className="h-24" />
      <h1 className="mt-4 font-heading text-2xl text-cadence-ink">{title}</h1>
      {children ? <div className="mt-3 max-w-md font-body text-sm text-cadence-ink/70">{children}</div> : null}
    </main>
  );
}

export function BackendDownScreen() {
  const { refresh } = useSession();
  const [retrying, setRetrying] = useState(false);

  async function retry() {
    setRetrying(true);
    try {
      await refresh();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <StatusScreen title="The API isn’t running">
      <p>
        The frontend is up, but it can’t reach the API right now. Try again in a moment, or open
        sign-in to keep browsing the UI.
      </p>
      <p className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={retry} disabled={retrying}>
          {retrying ? "Retrying…" : "Retry"}
        </Button>
        <Tooltip content="Open the shared sign-in page">
          <Link
            href="/login"
            className="inline-flex rounded-full bg-cadence-yellow px-5 py-2 font-body text-sm text-cadence-ink"
          >
            Go to sign in
          </Link>
        </Tooltip>
      </p>
    </StatusScreen>
  );
}
