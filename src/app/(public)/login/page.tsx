"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useSession } from "@/auth/session-context";
import { login as loginAction } from "@/features/accounts/actions";
import { loginSchema, type LoginFormValues } from "@/features/accounts/schemas";
import { messageFrom } from "@/shared/lib/errors";
import { Button, Field, Input } from "@/shared/ui";

/**
 * The ONE shared login page (ARCHITECTURE.md §2.4): staff by email, workers
 * by username, one `login` field either way. Where the user lands after is
 * decided by `user_type` in the response, never guessed client-side.
 */
export default function LoginPage() {
  const router = useRouter();
  const { session, isLoading, refresh } = useSession();
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
    <main className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 shadow-sm">
        <h1 className="mb-1 font-heading text-4xl text-cadence-ink">Cadence</h1>
        <p className="mb-6 font-body text-sm text-cadence-ink/70">Sign in to your account</p>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <Field label="Email or username" htmlFor="login" error={errors.login?.message}>
            <Input id="login" autoComplete="username" {...register("login")} />
          </Field>
          <Field label="Password" htmlFor="password" error={errors.password?.message}>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register("password")}
            />
          </Field>
          {formError ? <p className="font-body text-sm text-cadence-red">{formError}</p> : null}
          <Button type="submit" disabled={isSubmitting} className="mt-2 w-full">
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </main>
  );
}
