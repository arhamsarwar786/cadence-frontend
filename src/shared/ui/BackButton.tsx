"use client";

import { usePathname, useRouter } from "next/navigation";
import { PORTAL_DOCK, PORTAL_MORE } from "@/permissions/portal-nav";
import { STAFF_NAV_ITEMS } from "@/permissions/staff-nav";
import { cn } from "@/shared/lib/cn";
import { Tooltip } from "@/shared/ui/Tooltip";

/** Screens reachable from the dock or More menu — everything else is a sub page. */
const TOP_LEVEL = new Set<string>([
  "/",
  "/tasks",
  ...STAFF_NAV_ITEMS.map((item) => item.href),
  ...PORTAL_DOCK.map((item) => item.href),
  ...PORTAL_MORE.map((item) => item.href),
]);

/** Nearest top-level screen above `pathname` — where Back lands with no history. */
function parentOf(pathname: string): string {
  let best = pathname.startsWith("/portal") ? "/portal" : "/";
  for (const href of TOP_LEVEL) {
    if (href !== pathname && pathname.startsWith(`${href}/`) && href.length > best.length) best = href;
  }
  return best;
}

/** Back arrow shown on every sub page; renders nothing on top-level screens. */
export function BackButton({ className }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  if (!pathname || TOP_LEVEL.has(pathname)) return null;

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push(parentOf(pathname));
  }

  return (
    <Tooltip content="Back">
      <button
        type="button"
        onClick={goBack}
        aria-label="Back"
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cadence-ink/10 bg-surface/80 text-cadence-ink transition-colors hover:bg-surface",
          className,
        )}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </Tooltip>
  );
}
