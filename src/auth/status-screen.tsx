import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLockup, Tooltip } from "@/shared/ui";

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
  return (
    <StatusScreen title="The API isn’t running">
      <p>
        The frontend is up. Start the backend (default{" "}
        <span className="font-fine text-cadence-ink">http://localhost:8000</span>) and refresh, or open
        sign-in to keep browsing the UI.
      </p>
      <p className="mt-6">
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
