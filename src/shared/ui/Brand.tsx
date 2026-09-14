import Link from "next/link";
import { cn } from "@/shared/lib/cn";

const MARK = "/brand/mark-full.png";
const WORDMARK = "/brand/wordmark.png";
const LOCKUP = "/brand/lockup.png";

export function BrandMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={MARK} alt="" className={cn("h-8 w-auto object-contain", className)} />
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={WORDMARK} alt="Cadence" className={cn("h-8 w-auto object-contain", className)} />
  );
}

export function BrandLockup({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={LOCKUP} alt="Cadence" className={cn("h-28 w-auto", className)} />
  );
}

/** Header wordmark only — no mark, no tooltip. */
export function BrandLink({ href }: { href: string }) {
  return (
    <Link href={href} className="flex items-center" aria-label="Cadence home">
      <BrandWordmark className="h-9 sm:h-10" />
    </Link>
  );
}
