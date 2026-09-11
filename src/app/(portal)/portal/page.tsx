"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "@/auth/session-context";
import { getMe, listShifts } from "@/features/portal/api";
import { LIFECYCLE_STATUS_LABELS, type LifecycleStatus } from "@/shared/lib/status-labels";

/** Portal home (ARCHITECTURE.md §7) — the build order's step-9 loop
 * finished: a lifecycle-aware summary plus the pending-offers count. */
export default function PortalHomePage() {
  const { session } = useSession();
  const meQuery = useQuery({ queryKey: ["portal", "me"], queryFn: getMe });
  const shiftsQuery = useQuery({ queryKey: ["portal", "shifts"], queryFn: listShifts });

  const me = meQuery.data;
  const offerCount = new Set(
    (shiftsQuery.data ?? []).filter((s) => s.offer_status === "offered").map((s) => s.assignment_id),
  ).size;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl text-cadence-ink">
          Welcome{session ? `, ${session.user.login}` : ""}
        </h1>
        {me ? (
          <p className="mt-1 font-body text-sm text-cadence-ink/70">
            Status: {LIFECYCLE_STATUS_LABELS[me.lifecycle_status as LifecycleStatus]}
          </p>
        ) : null}
      </div>

      {me?.lifecycle_status === "applicant" ? (
        <div className="rounded-lg border border-cadence-orange bg-cadence-orange/10 p-4">
          <p className="font-body text-sm text-cadence-ink">
            Finish your onboarding to get started.
          </p>
          <Link href="/portal/onboarding" className="mt-2 inline-block font-body text-sm text-cadence-red underline">
            Go to onboarding
          </Link>
        </div>
      ) : null}

      {offerCount > 0 ? (
        <div className="rounded-lg border border-cadence-yellow bg-cadence-yellow/20 p-4">
          <p className="font-body text-sm text-cadence-ink">
            You have {offerCount} pending shift offer{offerCount === 1 ? "" : "s"}.
          </p>
          <Link href="/portal/offers" className="mt-2 inline-block font-body text-sm text-cadence-red underline">
            Review offers
          </Link>
        </div>
      ) : null}

      <p className="font-body text-sm text-cadence-ink/70">
        Your shifts, pay statements and profile are in the menu above.
      </p>
    </div>
  );
}
