import { Loading } from "@/shared/ui/Loading";

export interface ListSkeletonProps {
  rows?: number;
  className?: string;
}

/** Kept for call-site compatibility; renders the Cadence loader. */
export function ListSkeleton({ className }: ListSkeletonProps) {
  return <Loading label="Loading list" className={className} />;
}
