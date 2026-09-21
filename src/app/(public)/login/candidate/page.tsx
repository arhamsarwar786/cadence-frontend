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

const AGENCY_KEY = "cadence.selectedAgency.candidate";

type Step = "agency" | "fork" | "signin";

export default function CandidateLoginPage() {
  const router = useRouter();
  const { session, isLoading, refresh } = useSession();
  const [step, setStep] = useState<Step>("agency");
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
      setStep("fork");
    }
  }, []);

  function pickAgency(name: string) {
    sessionStorage.setItem(AGENCY_KEY, name);
    setAgencyName(name);
    setStep("fork");
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
    <AuthSplitLayout
      title="Candidate sign-in"
      strapline="Find your agency, then log in or finish onboarding."
    >
      {step === "agency" ? (
        <div>
          <h2 className="font-heading text-2xl text-cadence-ink">Find your agency</h2>
          <div className="mt-4">
            <Field label="Search" htmlFor="cq">
              <Input
                id="cq"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search agencies…"
              />
            </Field>
          </div>
          <button
            type="button"
            className="mt-4 w-full rounded-2xl border border-cadence-ink/10 bg-white px-4 py-3 text-left"
            onClick={() => pickAgency(query.trim() || "Cadence Demo")}
          >
            <span className="block font-body text-sm font-medium">
              {query.trim() || "Cadence Demo"}
            </span>
            <span className="block font-body text-xs text-cadence-ink/50">Continue with this agency</span>
          </button>
          <p className="mt-6 font-body text-xs text-cadence-ink/50">
            Can&apos;t find your agency? Ask your recruiter for an invite.{" "}
            <Link href="/login" className="underline">
              Back
            </Link>
          </p>
        </div>
      ) : null}

      {step === "fork" ? (
        <div>
          <div className="mb-6 flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm">
            <span className="font-medium">{agencyName}</span>
            <button
              type="button"
              className="text-xs underline"
              onClick={() => {
                sessionStorage.removeItem(AGENCY_KEY);
                setStep("agency");
              }}
            >
              Change
            </button>
          </div>
          <h2 className="font-heading text-2xl text-cadence-ink">Welcome back.</h2>
          <p className="mt-2 mb-6 font-body text-sm text-cadence-ink/60">
            Log in to your account, or finish setting one up.
          </p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setStep("signin")}
              className="rounded-2xl bg-cadence-yellow px-5 py-4 text-left"
            >
              <span className="block font-body font-medium">Log In</span>
              <span className="block text-sm text-cadence-ink/70">
                Already completed onboarding? Sign in to view your jobs
              </span>
            </button>
            <Link
              href="/login/candidate/onboarding"
              className="rounded-2xl border border-cadence-ink/10 bg-white px-5 py-4"
            >
              <span className="block font-body font-medium">Complete Onboarding</span>
              <span className="block text-sm text-cadence-ink/55">
                New here? Set up your profile to get started
              </span>
            </Link>
          </div>
          <p className="mt-6 font-body text-xs text-cadence-ink/50">Onboarding takes about 5 minutes.</p>
        </div>
      ) : null}

      {step === "signin" ? (
        <div>
          <h2 className="font-heading text-2xl text-cadence-ink">Enter your candidate account details.</h2>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 flex flex-col gap-4">
            <Field label="Email" htmlFor="login" error={errors.login?.message}>
              <Input id="login" type="email" autoComplete="username" {...register("login")} />
            </Field>
            <Field label="Password" htmlFor="password" error={errors.password?.message}>
              <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
            </Field>
            <Link href="/login/forgot" className="text-xs underline text-cadence-ink/55">
              Forgot password?
            </Link>
            {formError ? <p className="text-sm text-cadence-red">{formError}</p> : null}
            <Button type="submit" disabled={isSubmitting} className="h-11 w-full">
              {isSubmitting ? "Signing in…" : "Sign In"}
            </Button>
            <button type="button" className="text-xs underline" onClick={() => setStep("fork")}>
              Don&apos;t have an account? Complete onboarding
            </button>
          </form>
        </div>
      ) : null}
    </AuthSplitLayout>
  );
}
