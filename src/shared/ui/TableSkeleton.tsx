import { Loading } from "@/shared/ui/Loading";

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

/** Kept for call-site compatibility; renders the Cadence loader. */
export function TableSkeleton({ className }: TableSkeletonProps) {
  return <Loading label="Loading table" className={className} />;
}
