"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/auth/session-context";
import { AuthSplitLayout } from "@/app/(public)/_components/AuthSplitLayout";

export default function LoginChoicePage() {
  const router = useRouter();
  const { session, isLoading } = useSession();

  useEffect(() => {
    if (!isLoading && session) {
      router.replace(session.user.user_type === "worker" ? "/portal" : "/");
    }
  }, [isLoading, session, router]);

  return (
    <AuthSplitLayout>
      <h2 className="font-heading text-2xl text-cadence-ink">How would you like to sign in?</h2>
      <p className="mt-2 mb-8 font-body text-sm text-cadence-ink/60">
        Choose the option that matches your role.
      </p>
      <div className="flex flex-col gap-3">
        <ChoiceRow
          href="/login/agency"
          title="Agency Login"
          description="For staffing agency teams managing clients, jobs and payroll"
        />
        <ChoiceRow
          href="/login/candidate"
          title="Candidate Login"
          description="For employees placed by an agency — view jobs and onboarding"
        />
      </div>
      <p className="mt-8 font-body text-xs text-cadence-ink/50">
        Need help signing in? Contact your agency administrator.
      </p>
    </AuthSplitLayout>
  );
}

function ChoiceRow({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-2xl border border-cadence-ink/10 bg-white px-5 py-4 transition hover:border-cadence-yellow hover:bg-cadence-yellow/20"
    >
      <span>
        <span className="block font-body text-base font-medium text-cadence-ink">{title}</span>
        <span className="mt-0.5 block font-body text-sm text-cadence-ink/55">{description}</span>
      </span>
      <span className="font-heading text-xl text-cadence-ink/60 transition group-hover:text-cadence-ink">
        ›
      </span>
    </Link>
  );
}
