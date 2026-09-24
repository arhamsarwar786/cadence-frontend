import type { ReactNode } from "react";
import { BrandWordmark } from "@/shared/ui";

/** Shared yellow/cream split used by login choice and agency/candidate flows. */
export function AuthSplitLayout({
  children,
  title = "Welcome to Cadence.",
  strapline = "All-in-one software for staffing agencies — onboarding, scheduling, payroll and invoicing",
}: {
  children: ReactNode;
  title?: string;
  strapline?: string;
}) {
  return (
    <main className="flex min-h-dvh items-stretch justify-center px-0 py-4 sm:px-4 sm:py-6">
      <div className="grid w-full max-w-5xl bg-surface shadow-card max-md:overflow-visible md:min-h-[36rem] md:grid-cols-2 md:overflow-hidden md:rounded-[2rem]">
        <aside className="relative flex flex-col justify-between bg-cadence-yellow px-8 py-10 text-cadence-ink sm:px-10">
          <BrandWordmark className="h-9" />
          <div className="my-10 md:my-0">
            <h1 className="font-heading text-3xl leading-tight sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-sm font-body text-sm leading-relaxed text-cadence-ink/70">
              {strapline}
            </p>
          </div>
          <p className="font-fine text-[10px] uppercase tracking-wide text-cadence-ink/55">
            PIPEDA-compliant · Canadian-hosted
          </p>
        </aside>
        <section className="flex flex-col justify-center bg-[#faf7f0] px-6 py-10 sm:px-10">{children}</section>
      </div>
    </main>
  );
}
