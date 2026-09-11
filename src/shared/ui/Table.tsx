"use client";

import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

/** A plain data table. It renders exactly the rows it is given — a list
 * page owns fetching, pagination and filtering (ARCHITECTURE.md §2.5). */
export function Table<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = "No records.",
  onRowClick,
}: TableProps<T>) {
  if (rows.length === 0) {
    return <p className="py-10 text-center font-body text-sm text-cadence-ink/60">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full divide-y divide-border font-body text-sm">
        <thead className="bg-surface-muted">
          <tr>
            {columns.map((col) => (
              <th
                key={col.header}
                scope="col"
                className={cn(
                  "px-4 py-2 text-left font-subheading text-xs uppercase tracking-wide text-cadence-ink/70",
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(onRowClick && "cursor-pointer hover:bg-surface-muted")}
            >
              {columns.map((col) => (
                <td key={col.header} className={cn("px-4 py-3", col.className)}>
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
