"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useSession } from "@/auth/session-context";
import { login as loginAction } from "@/features/accounts/actions";
import { loginSchema, type LoginFormValues } from "@/features/accounts/schemas";
import { messageFrom } from "@/shared/lib/errors";
import { BrandMark, BrandWordmark, Button, Field, Input } from "@/shared/ui";

/**
 * The ONE shared login page (ARCHITECTURE.md §2.4): staff by email, workers
 * by username, one `login` field either way. Where the user lands after is
 * decided by `user_type` in the response, never guessed client-side.
 */
export default function LoginPage() {
  const router = useRouter();
  const { session, isLoading, isError, isUnavailable, refresh } = useSession();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-[2rem] bg-surface shadow-card md:grid-cols-[1.15fr_0.85fr]">
        <div className="flex flex-col justify-center p-8 sm:p-10">
          <BrandWordmark className="mb-8 h-9" />
          <h1 className="font-heading text-3xl text-cadence-ink">Welcome back</h1>
          <p className="mt-2 mb-8 font-body text-sm text-cadence-ink/60">
            Sign in with your office email or worker username.
          </p>
          {isUnavailable || isError ? (
            <p className="mb-6 rounded-2xl bg-cadence-yellow/50 px-4 py-3 font-body text-sm text-cadence-ink">
              Can&apos;t reach the API. Start the backend on port 8000 before submitting.
            </p>
          ) : null}
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
            <Field
              label="Email or username"
              htmlFor="login"
              error={errors.login?.message}
              hint="Staff use email. Workers use username."
            >
              <Input
                id="login"
                autoComplete="username"
                autoFocus
                className="h-11"
                placeholder="you@office.com"
                {...register("login")}
              />
            </Field>
            <Field label="Password" htmlFor="password" error={errors.password?.message}>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="h-11 pr-16"
                  {...register("password")}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 font-body text-xs font-medium text-cadence-ink/55 hover:text-cadence-ink"
                  onClick={() => setShowPassword((open) => !open)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </Field>
            {formError ? (
              <p role="alert" className="font-body text-sm text-cadence-red">
                {formError}
              </p>
            ) : null}
            <Button type="submit" disabled={isSubmitting} className="mt-1 h-11 w-full">
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
            <p className="font-body text-xs leading-relaxed text-cadence-ink/55">
              Passwords are reset by your office — there is no self-serve link. Staff: ask a root
              user. Workers: ask the office that placed you.
            </p>
          </form>
        </div>

        <aside className="relative hidden overflow-hidden bg-card px-10 py-12 text-on-card md:flex md:flex-col md:items-center md:justify-center md:gap-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cadence-orange/25"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-cadence-yellow/20"
          />
          <div className="relative flex h-40 w-40 items-center justify-center rounded-full bg-surface">
            <BrandMark className="h-24 w-auto" />
          </div>
          <div className="relative max-w-[16rem] text-center">
            <p className="font-heading text-3xl leading-tight">Staffing, in cadence.</p>
            <p className="mt-3 font-body text-sm leading-relaxed text-on-card-muted">
              One office. One sign-in. Where you land depends on the account.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
