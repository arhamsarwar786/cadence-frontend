"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listUsersNormalized, userKeys } from "@/features/accounts/api";
import { resetUserCredentials } from "@/features/accounts/actions";
import type { StaffUser } from "@/features/accounts/types";
import { PERM } from "@/permissions/keys";
import { messageFrom } from "@/shared/lib/errors";
import { Button, Field, Input, PermGate } from "@/shared/ui";

function findPortalUser(users: StaffUser[], employeeId: string): StaffUser | undefined {
  return users.find(
    (u) => u.user_type === "worker" && u.employee_id === employeeId && u.status !== "deactivated",
  );
}

export function WorkerPortalAccessPanel({ workerId }: { workerId: string }) {
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const usersQuery = useQuery({
    queryKey: userKeys.list({ pageSize: 200 }),
    queryFn: () => listUsersNormalized({ pageSize: 200 }),
  });

  const portalUser = usersQuery.data ? findPortalUser(usersQuery.data, workerId) : undefined;

  async function handleSetPassword() {
    if (!portalUser) return;
    setFormError(null);
    setSaved(false);
    if (!password.trim()) {
      setFormError("Enter a new password.");
      return;
    }
    try {
      await resetUserCredentials(portalUser.id, password);
      setPassword("");
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: userKeys.all });
    } catch (err) {
      setFormError(messageFrom(err));
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface/80 p-4">
      <div>
        <h3 className="font-heading text-lg text-cadence-ink">Worker portal sign-in</h3>
        <p className="mt-1 text-sm text-cadence-ink/60">
          Workers use the same sign-in API as staff:{" "}
          <code className="text-xs">POST /api/v1/auth/login/</code> with{" "}
          <code className="text-xs">login</code> + <code className="text-xs">password</code>. On
          the website they start at{" "}
          <Link href="/login/candidate" className="underline">
            Candidate login
          </Link>
          , choose your agency, then enter their <strong>username</strong> (not staff email).
        </p>
      </div>

      {usersQuery.isLoading ? (
        <p className="text-sm text-cadence-ink/55">Checking portal account…</p>
      ) : usersQuery.isError ? (
        <p className="text-sm text-cadence-red">{messageFrom(usersQuery.error)}</p>
      ) : portalUser ? (
        <div className="rounded-lg bg-cadence-yellow/25 p-3">
          <p className="text-sm font-medium text-cadence-ink">
            Portal username: {portalUser.login_masked ?? "—"}
          </p>
          <p className="mt-1 text-xs text-cadence-ink/55">
            Status: {portalUser.status}. Full username is shown masked in the roster; the worker
            knows the value you gave them.
          </p>
          <PermGate anyOf={PERM.ADMIN_USERS_RESET_CREDENTIALS}>
            <div className="mt-4 flex max-w-sm flex-col gap-3">
              <Field label="Set new portal password" htmlFor="portal-password">
                <Input
                  id="portal-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              {formError ? <p className="text-sm text-cadence-red">{formError}</p> : null}
              {saved ? (
                <p className="text-sm text-green-800">
                  Password updated. Worker can sign in immediately with the same username.
                </p>
              ) : null}
              <Button size="sm" onClick={handleSetPassword}>
                Update password
              </Button>
            </div>
          </PermGate>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-3 text-sm text-cadence-ink/70">
          <p className="font-medium text-cadence-ink">No portal login linked yet</p>
          <p className="mt-2">
            This employee record has no worker user in{" "}
            <Link href="/admin/users" className="underline">
              Users &amp; permissions
            </Link>
            . Until a worker account exists (username linked to this employee),{" "}
            <code className="text-xs">/api/v1/auth/login/</code> cannot authenticate them.
          </p>
          <p className="mt-2">
            New candidates can use{" "}
            <Link href="/login/candidate/onboarding" className="underline">
              Complete onboarding
            </Link>{" "}
            when self-serve signup is enabled for your agency.
          </p>
        </div>
      )}
    </div>
  );
}
