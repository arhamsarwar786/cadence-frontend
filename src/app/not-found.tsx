import Link from "next/link";
import { BrandLockup, Tooltip } from "@/shared/ui";

/**
 * Cross-tenant or out-of-scope ids resolve here too (ARCHITECTURE.md §10):
 * a 404 never hints that a row exists somewhere else.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <BrandLockup className="h-20" />
      <h1 className="font-heading text-6xl text-cadence-ink">404</h1>
      <p className="font-body text-base text-cadence-ink/70">
        This page doesn&apos;t exist, or you don&apos;t have access to it.
      </p>
      <Tooltip content="Return to Cadence home">
        <Link
          href="/"
          className="rounded-full bg-cadence-yellow px-5 py-2 font-body text-sm text-cadence-ink"
        >
          Back to home
        </Link>
      </Tooltip>
    </main>
  );
}
