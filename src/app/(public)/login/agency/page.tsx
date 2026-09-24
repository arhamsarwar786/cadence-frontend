"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { AuthSplitLayout } from "@/app/(public)/_components/AuthSplitLayout";
import { useSession } from "@/auth/session-context";
import { login as loginAction } from "@/features/accounts/actions";
import { loginSchema, type LoginFormValues } from "@/features/accounts/schemas";
import { getReportsDashboard } from "@/features/money/api";
import type { Dashboard } from "@/features/money/types";
import { listTasks } from "@/features/tasks/api";
import type { Task } from "@/features/tasks/types";
import { hasPerm } from "@/permissions/has-perm";
import { PERM } from "@/permissions/keys";
import { messageFrom } from "@/shared/lib/errors";
import { Button, Field, Input } from "@/shared/ui";

const AGENCY_KEY = "cadence.selectedAgency";
const SUCCESS_REDIRECT_MS = 2500;

/** Stub until GET /agencies/?q= ships — local pick only, no network call. */
const DEMO_AGENCIES = [
  { id: "demo", name: "Cadence Demo", subtitle: "Demo staffing office" },
];

type SuccessStats = {
  jobsFilled: number;
  jobsCount: number;
  fillRatePct: number | null;
};

function statsFromDashboard(data: Dashboard): SuccessStats {
  const fill = data.fill_rate;
  return {
    jobsFilled: fill.headcount_filled,
    jobsCount: fill.jobs_count,
    fillRatePct: fill.fill_rate != null ? Math.round(Number(fill.fill_rate) * 100) : null,
  };
}

export default function AgencyLoginPage() {
  const router = useRouter();
  const { session, isLoading, refresh } = useSession();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [agencyName, setAgencyName] = useState("");
  const [query, setQuery] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [stats, setStats] = useState<SuccessStats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const stayOnSuccess = useRef(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (stayOnSuccess.current || step === 3) return;
    if (!isLoading && session) {
      router.replace(session.user.user_type === "worker" ? "/portal" : "/");
    }
  }, [isLoading, session, router, step]);

  useEffect(() => {
    const stored = sessionStorage.getItem(AGENCY_KEY);
    if (stored) {
      setAgencyName(stored);
      setStep(2);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  const filtered = DEMO_AGENCIES.filter(
    (a) =>
      !query.trim() ||
      a.name.toLowerCase().includes(query.toLowerCase()) ||
      a.subtitle.toLowerCase().includes(query.toLowerCase()),
  );

  function pickAgency(name: string) {
    sessionStorage.setItem(AGENCY_KEY, name);
    setAgencyName(name);
    setStep(2);
  }

  function goToDashboard() {
    if (redirectTimer.current) clearTimeout(redirectTimer.current);
    router.replace("/");
  }

  async function onSubmit(values: LoginFormValues) {
    setFormError(null);
    try {
      const user = await loginAction(values.login, values.password);
      if (user.user_type === "worker") {
        await refresh();
        router.replace("/portal");
        return;
      }

      stayOnSuccess.current = true;
      await refresh();

      let nextStats: SuccessStats | null = null;
      if (hasPerm(user, PERM.REPORTS_DASHBOARD_VIEW)) {
        try {
          nextStats = statsFromDashboard(await getReportsDashboard());
        } catch {
          nextStats = null;
        }
      }

      let nextTasks: Task[] = [];
      try {
        const page = await listTasks({ pageSize: 3, status: "open" });
        nextTasks = page.results.slice(0, 3);
      } catch {
        nextTasks = [];
      }

      setStats(nextStats);
      setTasks(nextTasks);
      setStep(3);
      redirectTimer.current = setTimeout(() => {
        router.replace("/");
      }, SUCCESS_REDIRECT_MS);
    } catch (error) {
      stayOnSuccess.current = false;
      setFormError(messageFrom(error));
    }
  }

  return (
    <AuthSplitLayout title="Agency sign-in" strapline="Select your office, then sign in with your work email.">
      {step === 1 ? (
        <div>
          <h2 className="font-heading text-2xl text-cadence-ink">Find your agency</h2>
          <p className="mt-2 mb-6 font-body text-sm text-cadence-ink/60">
            Select the agency that manages your work.
          </p>
          <Field label="Search agencies" htmlFor="agency-q">
            <Input
              id="agency-q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search agencies…"
              autoFocus
            />
          </Field>
          <ul className="scroll-area-y mt-4 flex max-h-[min(14rem,40dvh)] flex-col gap-2">
            {filtered.map((agency) => (
              <li key={agency.id}>
                <button
                  type="button"
                  onClick={() => pickAgency(agency.name)}
                  className="flex w-full items-center justify-between rounded-2xl border border-cadence-ink/10 bg-white px-4 py-3 text-left hover:border-cadence-yellow"
                >
                  <span>
                    <span className="block font-body text-sm font-medium">{agency.name}</span>
                    <span className="block font-body text-xs text-cadence-ink/50">{agency.subtitle}</span>
                  </span>
                  <span className="text-cadence-ink/60">›</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="rounded-2xl border border-dashed border-cadence-ink/15 px-4 py-6 text-center font-body text-sm text-cadence-ink/50">
                No agencies match. Agency search API is not live yet — ask your administrator for the
                demo office name, or type it below.
              </li>
            ) : null}
          </ul>
          <div className="mt-4 flex gap-2">
            <Input
              placeholder="Or enter agency name"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
            />
            <Button
              type="button"
              disabled={!agencyName.trim()}
              onClick={() => pickAgency(agencyName.trim())}
            >
              Continue
            </Button>
          </div>
          <p className="mt-6 font-body text-xs text-cadence-ink/50">
            <Link href="/login" className="underline">
              Back
            </Link>
          </p>
        </div>
      ) : step === 2 ? (
        <div>
          <div className="mb-6 flex items-center gap-2 rounded-full bg-white px-3 py-1.5 font-body text-sm">
            <span className="font-medium text-cadence-ink">{agencyName}</span>
            <button
              type="button"
              className="font-fine text-[10px] uppercase tracking-wide text-cadence-ink/60 underline"
              onClick={() => {
                sessionStorage.removeItem(AGENCY_KEY);
                setStep(1);
              }}
            >
              Change
            </button>
          </div>
          <h2 className="font-heading text-2xl text-cadence-ink">Good to see you again.</h2>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 flex flex-col gap-4">
            <Field label="Work email" htmlFor="login" error={errors.login?.message}>
              <Input
                id="login"
                type="email"
                autoComplete="username"
                placeholder="you@agency.com"
                {...register("login")}
              />
            </Field>
            <Field label="Password" htmlFor="password" error={errors.password?.message}>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password")}
              />
            </Field>
            <Link href="/login/forgot" className="font-body text-xs text-cadence-ink/55 underline">
              Forgot password?
            </Link>
            {formError ? <p className="font-body text-sm text-cadence-red">{formError}</p> : null}
            <Button type="submit" disabled={isSubmitting} className="h-11 w-full">
              {isSubmitting ? "Signing in…" : "Sign In"}
            </Button>
            <p className="font-body text-xs text-cadence-ink/50">
              Don&apos;t have access? Contact your Cadence administrator.
            </p>
          </form>
        </div>
      ) : (
        <div className="flex flex-col items-center text-center">
          <span
            aria-hidden
            className="flex h-14 w-14 items-center justify-center rounded-full bg-cadence-lime/50 text-2xl text-cadence-ink"
          >
            ✓
          </span>
          <h2 className="mt-5 font-heading text-2xl text-cadence-ink">Signed in successfully</h2>
          <p className="mt-2 font-body text-sm text-cadence-ink/60">
            Redirecting you to the {agencyName || "agency"} dashboard…
          </p>

          {stats ? (
            <div className="mt-8 flex w-full justify-center gap-8">
              <div>
                <p className="font-heading text-3xl text-cadence-ink">{stats.jobsFilled}</p>
                <p className="mt-1 font-fine text-[10px] uppercase tracking-wide text-cadence-ink/55">
                  Jobs filled
                </p>
              </div>
              <div>
                <p className="font-heading text-3xl text-cadence-ink">{stats.jobsCount}</p>
                <p className="mt-1 font-fine text-[10px] uppercase tracking-wide text-cadence-ink/55">
                  Jobs
                </p>
              </div>
              <div>
                <p className="font-heading text-3xl text-cadence-ink">
                  {stats.fillRatePct != null ? `${stats.fillRatePct}%` : "—"}
                </p>
                <p className="mt-1 font-fine text-[10px] uppercase tracking-wide text-cadence-ink/55">
                  Fill rate
                </p>
              </div>
            </div>
          ) : null}

          {tasks.length > 0 ? (
            <div className="mt-8 w-full text-left">
              <p className="font-subheading text-[10px] uppercase tracking-[0.18em] text-cadence-ink/55">
                Today&apos;s to-do
              </p>
              <ul className="mt-3 divide-y divide-cadence-ink/10 rounded-2xl border border-cadence-ink/10 bg-white">
                {tasks.map((task) => (
                  <li key={task.id} className="px-4 py-3 font-body text-sm text-cadence-ink">
                    {task.title}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Button type="button" className="mt-8 h-11 w-full" onClick={goToDashboard}>
            Go to Dashboard
          </Button>
        </div>
      )}
    </AuthSplitLayout>
  );
}
