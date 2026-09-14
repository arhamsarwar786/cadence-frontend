import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export function PortalFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-heading text-3xl text-cadence-ink sm:text-4xl">{title}</h1>
        {subtitle ? (
          <p className="mt-1 max-w-2xl font-body text-sm text-cadence-ink/60">{subtitle}</p>
        ) : null}
      </header>
      {children}
    </div>
  );
}

export function PortalCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-[2rem] bg-surface/80 p-6 shadow-card", className)}>
      {children}
    </section>
  );
}
