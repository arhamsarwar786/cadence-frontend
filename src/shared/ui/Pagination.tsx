import { Button } from "@/shared/ui/Button";

export interface PaginationProps {
  /** 1-indexed current page. */
  page: number;
  pageSize: number;
  /** The paginated envelope's `count` (ARCHITECTURE.md §4). */
  count: number;
  onPageChange: (page: number) => void;
}

/**
 * Presentational only — page state itself lives in the URL (`?page=`), owned
 * by the calling page (ARCHITECTURE.md §2.5), never in component state.
 */
export function Pagination({ page, pageSize, count, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  if (totalPages <= 1) return null;

  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);

  return (
    <nav className="flex items-center justify-between gap-4 font-body text-sm text-cadence-ink/70">
      <span>
        {from}–{to} of {count}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          tooltip="Previous page"
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span className="font-fine text-xs">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          tooltip="Next page"
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
