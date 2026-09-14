"use client";

import { useEffect } from "react";
import { BrandLockup, Button } from "@/shared/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <BrandLockup className="h-20" />
      <h1 className="mt-6 font-heading text-2xl text-cadence-ink">Something went wrong</h1>
      <p className="mt-2 max-w-md font-body text-sm text-cadence-ink/70">
        The screen failed to load. Try again. If this keeps happening, sign out and sign back in.
      </p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
