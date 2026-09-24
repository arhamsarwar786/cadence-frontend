"use client";

import type { KeyboardEvent, ReactNode } from "react";
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

/** Charcoal list card from the Penpot screens. A list page owns fetching,
 * pagination and filtering (ARCHITECTURE.md §2.5). */
export function Table<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = "No records.",
  onRowClick,
}: TableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[2rem] bg-card px-6 py-16 text-center text-on-card shadow-card">
        <p className="font-body text-sm text-on-card-muted">{emptyMessage}</p>
      </div>
    );
  }

  function onRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, row: T) {
    if (!onRowClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRowClick(row);
    }
  }

  return (
    <div className="overflow-hidden rounded-[2rem] bg-card text-on-card shadow-card">
      <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        <table className="min-w-full font-body text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="text-on-card-muted">
              {columns.map((col) => (
                <th
                  key={col.header}
                  scope="col"
                  className={cn(
                    "px-4 py-3 text-left font-subheading text-[10px] font-normal uppercase tracking-[0.14em]",
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (event) => onRowKeyDown(event, row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(
                  "border-t border-white/5",
                  onRowClick &&
                    "cursor-pointer hover:bg-white/5 focus-visible:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cadence-yellow",
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.header}
                    className={cn("px-4 py-3.5 text-on-card", col.className)}
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest("button, a, input, select")) {
                        event.stopPropagation();
                      }
                    }}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
