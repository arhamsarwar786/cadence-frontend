"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "@/auth/session-context";
import { getMe, listSignatureRequests, listShifts } from "@/features/portal/api";
import { LIFECYCLE_STATUS_LABELS, type LifecycleStatus } from "@/shared/lib/status-labels";
import { PortalCard } from "../_components/PortalFrame";

export default function PortalHomePage() {
  const { session } = useSession();
  const meQuery = useQuery({ queryKey: ["portal", "me"], queryFn: getMe });
  const shiftsQuery = useQuery({ queryKey: ["portal", "shifts"], queryFn: listShifts });
  const requestsQuery = useQuery({
    queryKey: ["portal", "signature-requests"],
    queryFn: listSignatureRequests,
  });

  const me = meQuery.data;
  const offerCount = new Set(
    (shiftsQuery.data ?? []).filter((s) => s.offer_status === "offered").map((s) => s.assignment_id),
  ).size;
  const upcoming = (shiftsQuery.data ?? []).filter((s) => s.offer_status !== "offered").length;
  const pendingSigns = (requestsQuery.data ?? []).filter((r) => r.status === "pending").length;
  const lifecycle = me?.lifecycle_status as LifecycleStatus | undefined;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="pt-2">
        <p className="font-fine text-[10px] uppercase tracking-[0.18em] text-cadence-ink/40">
          Worker portal
        </p>
        <h1 className="mt-2 font-heading text-4xl text-cadence-ink sm:text-5xl">
          Welcome{me ? `, ${me.first_name}` : session ? `, ${session.user.login}` : ""}
        </h1>
        {lifecycle ? (
          <p className="mt-2 font-body text-sm text-cadence-ink/60">
            Status: {LIFECYCLE_STATUS_LABELS[lifecycle]}
            {me?.work_status ? ` · ${me.work_status.replace("_", " ")}` : ""}
          </p>
        ) : null}
        <div className="mt-10 flex flex-wrap items-end gap-8">
          <div>
            <p className="font-heading text-6xl leading-none text-cadence-orange">
              {String(offerCount).padStart(2, "0")}
            </p>
            <p className="mt-1 font-fine text-[10px] uppercase tracking-wide text-cadence-ink/40">
              Offers
            </p>
          </div>
          <div>
            <p className="font-heading text-6xl leading-none text-cadence-lime">
              {String(upcoming).padStart(2, "0")}
            </p>
            <p className="mt-1 font-fine text-[10px] uppercase tracking-wide text-cadence-ink/40">
              Shifts
            </p>
          </div>
          <div>
            <p className="font-heading text-6xl leading-none text-cadence-ink">
              {String(pendingSigns).padStart(2, "0")}
            </p>
            <p className="mt-1 font-fine text-[10px] uppercase tracking-wide text-cadence-ink/40">
              To sign
            </p>
          </div>
        </div>
      </section>

      <PortalCard className="flex flex-col gap-4 bg-card p-5 text-on-card">
        {lifecycle === "applicant" ? (
          <div>
            <p className="font-subheading text-xs uppercase tracking-[0.18em] text-cadence-yellow">
              Next step
            </p>
            <p className="mt-3 font-body text-sm">
              Finish onboarding: consent, work authorization, and required documents. The office
              reviews after you submit.
            </p>
            <Link
              href="/portal/onboarding"
              className="mt-4 inline-flex rounded-full bg-cadence-yellow px-4 py-2 font-body text-xs text-cadence-ink"
            >
              Go to onboarding
            </Link>
          </div>
        ) : lifecycle === "onboarding" ? (
          <p className="font-body text-sm">
            Your paperwork is with the office. You can keep your profile, availability, and
            documents up to date while you wait.
          </p>
        ) : offerCount > 0 ? (
          <div>
            <p className="font-subheading text-xs uppercase tracking-[0.18em] text-cadence-yellow">
              Today
            </p>
            <p className="mt-3 font-body text-sm">
              You have {offerCount} pending shift offer{offerCount === 1 ? "" : "s"}.
            </p>
            <Link
              href="/portal/offers"
              className="mt-4 inline-flex rounded-full bg-cadence-yellow px-4 py-2 font-body text-xs text-cadence-ink"
            >
              Review offers
            </Link>
          </div>
        ) : pendingSigns > 0 ? (
          <div>
            <p className="font-subheading text-xs uppercase tracking-[0.18em] text-cadence-yellow">
              Signature
            </p>
            <p className="mt-3 font-body text-sm">
              {pendingSigns} form{pendingSigns === 1 ? "" : "s"} waiting for your signature.
            </p>
            <Link
              href="/portal/signatures"
              className="mt-4 inline-flex rounded-full bg-cadence-yellow px-4 py-2 font-body text-xs text-cadence-ink"
            >
              Open signatures
            </Link>
          </div>
        ) : (
          <p className="py-6 text-center font-body text-sm text-on-card-muted">
            Your shifts, pay statements, and profile are in the dock below.
          </p>
        )}
      </PortalCard>
    </div>
  );
}
