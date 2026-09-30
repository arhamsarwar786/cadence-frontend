"use client";

import { messageFrom } from "@/shared/lib/errors";
import { Button } from "@/shared/ui/Button";

/** Standard failed-load state: the API's own words plus a way to try again. */
export function QueryError({
  error,
  onRetry,
  className = "",
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={`flex flex-wrap items-center gap-3 ${className}`}>
      <p className="font-body text-sm text-cadence-red">{messageFrom(error)}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
