"use client";

import { isNotFound } from "@/shared/lib/errors";
import { Button, QueryError } from "@/shared/ui";

/** QueryError for paginated lists. DRF answers a page past the end with a
 * 404 ("Invalid page."), so past page 1 that error also offers a way back. */
export function ListError({
  error,
  page,
  onRetry,
  onFirstPage,
}: {
  error: unknown;
  page: number;
  onRetry: () => void;
  onFirstPage: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3">
      <QueryError error={error} onRetry={onRetry} />
      {page > 1 && isNotFound(error) ? (
        <Button variant="secondary" onClick={onFirstPage}>
          Back to page 1
        </Button>
      ) : null}
    </div>
  );
}
