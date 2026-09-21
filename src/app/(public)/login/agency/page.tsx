"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { AuthSplitLayout } from "@/app/(public)/_components/AuthSplitLayout";
import { useSession } from "@/auth/session-context";
import { login as loginAction } from "@/features/accounts/actions";
import { loginSchema, type LoginFormValues } from "@/features/accounts/schemas";
import { messageFrom } from "@/shared/lib/errors";
import { Button, Field, Input } from "@/shared/ui";

const AGENCY_KEY = "cadence.selectedAgency";

/** Stub until GET /agencies/?q= ships — local pick only, no network call. */
const DEMO_AGENCIES = [
  { id: "demo", name: "Cadence Demo", subtitle: "Demo staffing office" },
];

export default function AgencyLoginPage() {
  const router = useRouter();
  const { session, isLoading, refresh } = useSession();
  const [step, setStep] = useState<1 | 2>(1);
  const [agencyName, setAgencyName] = useState("");
  const [query, setQuery] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (!isLoading && session) {
      router.replace(session.user.user_type === "worker" ? "/portal" : "/");
    }
  }, [isLoading, session, router]);

  useEffect(() => {
    const stored = sessionStorage.getItem(AGENCY_KEY);
    if (stored) {
      setAgencyName(stored);
      setStep(2);
    }
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

  async function onSubmit(values: LoginFormValues) {
    setFormError(null);
    try {
      const user = await loginAction(values.login, values.password);
      await refresh();
      router.replace(user.user_type === "worker" ? "/portal" : "/");
    } catch (error) {
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
          <ul className="mt-4 flex max-h-56 flex-col gap-2 overflow-y-auto">
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
      ) : (
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
      )}
    </AuthSplitLayout>
  );
}
