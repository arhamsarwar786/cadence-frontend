"use client";

import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/auth/session-context";
import { api } from "@/api/client";
import { resetUserCredentials } from "@/features/accounts/actions";
import { listUsersNormalized, userKeys } from "@/features/accounts/api";
import {
  readKnownUserLogins,
  rememberUserLogin,
  summarizeUserAccess,
} from "@/features/accounts/roster-access";
import type { StaffUser } from "@/features/accounts/types";
import { getWorker } from "@/features/workers/api";
import { hasPerm } from "@/permissions/has-perm";
import { PERM, PERMISSION_CATALOG } from "@/permissions/keys";
import { messageFrom } from "@/shared/lib/errors";
import {
  Button,
  Dialog,
  Field,
  Input,
  ListSkeleton,
  PageFrame,
  PageHeader,
  PageScrollRegion,
  PermGate,
  Select,
  useConfirm,
} from "@/shared/ui";

interface UserGrant {
  permission_key: string;
  scope: "own" | "assigned" | "all";
}

function inviteUser(
  email: string,
): Promise<{ user: { id: string }; invite_token?: string }> {
  return api.post("/api/v1/auth/users/invite/", { email });
}

function deactivateUser(id: string): Promise<void> {
  return api.post(`/api/v1/auth/users/${id}/deactivate/`);
}

function getPermissions(id: string): Promise<UserGrant[]> {
  return api.get(`/api/v1/auth/users/${id}/permissions/`);
}

function putPermissions(id: string, grants: UserGrant[]): Promise<UserGrant[]> {
  return api.put(`/api/v1/auth/users/${id}/permissions/`, { grants });
}

const permissionQueryKey = (userId: string) => ["users", userId, "permissions"] as const;

function formatUserType(userType: string): string {
  if (userType === "worker") return "Worker";
  if (userType === "staff") return "Staff";
  return userType;
}

const NOOP_KEYS = new Set([
  "admin.users.edit",
  "admin.integrations.manage",
  "pii.bulk_export",
  "clients.export",
  "shifts.approve",
  "invoices.export",
  "email.inbox.access",
  "email.view",
  "email.send",
  "email.ai_intake.use",
  "email.accounts.manage",
  "esign.templates.manage",
  "notifications.send",
]);

function rosterPrimaryLabel(
  user: StaffUser,
  knownLogins: Record<string, string>,
  workerName?: string,
  workerEmail?: string,
): string {
  if (user.user_type === "worker") {
    if (workerName?.trim()) return workerName.trim();
    if (workerEmail?.trim()) return workerEmail.trim();
  }
  return knownLogins[user.id] ?? user.login_masked ?? "—";
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const session = useSession();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [knownLogins, setKnownLogins] = useState<Record<string, string>>({});

  useEffect(() => {
    setKnownLogins(readKnownUserLogins());
  }, []);

  const query = useQuery({
    queryKey: userKeys.list({ pageSize: 200 }),
    queryFn: () => listUsersNormalized({ pageSize: 200 }),
  });

  const [draftGrants, setDraftGrants] = useState<UserGrant[]>([]);

  const permsQuery = useQuery({
    queryKey: editingId ? permissionQueryKey(editingId) : ["users", "permissions", "idle"],
    queryFn: () => getPermissions(editingId!),
    enabled: Boolean(editingId),
  });

  useEffect(() => {
    if (!editingId || !permsQuery.data) return;
    setDraftGrants(Array.isArray(permsQuery.data) ? permsQuery.data : []);
  }, [editingId, permsQuery.data]);

  function openEditor(id: string) {
    setDraftGrants([]);
    setEditingId(id);
  }

  const users = query.data ?? [];
  const me = session.session?.user;
  const canLoadGrants = Boolean(me && hasPerm(me, PERM.ADMIN_PERMISSIONS_VIEW));

  const grantQueries = useQueries({
    queries: users.map((u) => ({
      queryKey: permissionQueryKey(u.id),
      queryFn: () => getPermissions(u.id),
      enabled: canLoadGrants && u.user_type === "staff",
      staleTime: 5 * 60_000,
    })),
  });

  const workerUsers = useMemo(
    () => users.filter((u) => u.employee_id),
    [users],
  );

  const workerQueries = useQueries({
    queries: workerUsers.map((u) => ({
      queryKey: ["workers", u.employee_id],
      queryFn: () => getWorker(u.employee_id!),
      enabled: Boolean(u.employee_id),
      staleTime: 5 * 60_000,
    })),
  });

  const grantsByUserId = useMemo(() => {
    const map = new Map<string, UserGrant[]>();
    users.forEach((u, index) => {
      const data = grantQueries[index]?.data;
      if (Array.isArray(data)) map.set(u.id, data);
    });
    return map;
  }, [users, grantQueries]);

  const workerByUserId = useMemo(() => {
    const map = new Map<string, Awaited<ReturnType<typeof getWorker>>>();
    workerUsers.forEach((u, index) => {
      const data = workerQueries[index]?.data;
      if (data) map.set(u.id, data);
    });
    return map;
  }, [workerUsers, workerQueries]);

  return (
    <PageFrame>
      <PageScrollRegion className="flex flex-col gap-6">
      <PageHeader
        title="Users & permissions"
        actions={
          <PermGate anyOf={PERM.ADMIN_USERS_CREATE}>
            <Button onClick={() => setInviteOpen(true)}>Invite user</Button>
          </PermGate>
        }
      />
      {error ? <p className="text-sm text-cadence-red">{error}</p> : null}
      <p className="font-fine text-xs text-cadence-ink/60">
        Staff sign-in addresses are abbreviated in the API (for example{" "}
        <span className="font-mono">d***@yourdomain.com</span>). Permission summaries below identify
        each account; emails you invite on this page are remembered in this browser.
      </p>
      {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError ? (
        <p className="text-sm text-cadence-red">{messageFrom(query.error)}</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {users.map((u) => {
            const worker = workerByUserId.get(u.id);
            const workerName =
              worker?.first_name || worker?.last_name
                ? `${worker?.first_name ?? ""} ${worker?.last_name ?? ""}`.trim()
                : undefined;
            const accessLabels = summarizeUserAccess(u, grantsByUserId.get(u.id));
            const primary = rosterPrimaryLabel(u, knownLogins, workerName, worker?.email);
            return (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-body text-sm font-medium break-all">{primary}</p>
                {u.user_type === "worker" && u.login_masked ? (
                  <p className="font-fine text-[11px] text-cadence-ink/70">
                    Portal login: {u.login_masked}
                    {worker?.email ? ` · ${worker.email}` : null}
                  </p>
                ) : knownLogins[u.id] && u.login_masked ? (
                  <p className="font-fine text-[11px] text-cadence-ink/70">API mask: {u.login_masked}</p>
                ) : null}
                <p className="font-fine text-[10px] uppercase text-cadence-ink/60">
                  {formatUserType(u.user_type)} · {u.status}
                  {u.is_root ? " · root" : ""}
                </p>
                {accessLabels.length ? (
                  <p className="mt-1 font-fine text-[11px] leading-snug text-cadence-ink/70">
                    {accessLabels.join(" · ")}
                  </p>
                ) : canLoadGrants && u.user_type === "staff" && grantQueries[users.indexOf(u)]?.isLoading ? (
                  <p className="mt-1 font-fine text-[11px] text-cadence-ink/50">Loading access…</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <PermGate anyOf={PERM.ADMIN_PERMISSIONS_MANAGE}>
                  <Button size="sm" variant="secondary" onClick={() => openEditor(u.id)}>
                    Permissions
                  </Button>
                </PermGate>
                <PermGate anyOf={PERM.ADMIN_USERS_RESET_CREDENTIALS}>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setResetUserId(u.id);
                      setResetPassword("");
                    }}
                  >
                    Set password
                  </Button>
                </PermGate>
                <PermGate anyOf={PERM.ADMIN_USERS_DEACTIVATE}>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Deactivate this user?",
                        body: "They will no longer be able to sign in.",
                        confirmLabel: "Deactivate",
                        danger: true,
                      });
                      if (!ok) return;
                      try {
                        await deactivateUser(u.id);
                        await queryClient.invalidateQueries({ queryKey: userKeys.all });
                      } catch (err) {
                        setError(messageFrom(err));
                      }
                    }}
                  >
                    Deactivate
                  </Button>
                </PermGate>
              </div>
            </li>
            );
          })}
        </ul>
      )}

      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite user">
        <Field label="Work email" htmlFor="invite-email">
          <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {inviteToken ? (
          <p className="mt-3 break-all rounded-xl bg-cadence-yellow/40 p-3 font-fine text-xs text-on-accent">
            Invite token (shown once): {inviteToken}
          </p>
        ) : null}
        <Button
          className="mt-4"
          onClick={async () => {
            setError(null);
            try {
              const res = await inviteUser(email);
              setInviteToken(res.invite_token ?? null);
              if (res.user?.id) {
                rememberUserLogin(res.user.id, email);
                setKnownLogins(readKnownUserLogins());
              }
              await queryClient.invalidateQueries({ queryKey: userKeys.all });
            } catch (err) {
              setError(messageFrom(err));
            }
          }}
        >
          Send invite
        </Button>
      </Dialog>

      {editingId ? (
        <Dialog open onClose={() => setEditingId(null)} title="Permission editor">
          {permsQuery.isLoading ? (
            <p className="text-sm text-on-card-muted">Loading…</p>
          ) : permsQuery.isError ? (
            <p className="text-sm text-cadence-red">{messageFrom(permsQuery.error)}</p>
          ) : (
            <div className="scroll-area-y flex max-h-[min(28rem,55dvh)] flex-col gap-2">
              {PERMISSION_CATALOG.map((key) => {
                const grant = draftGrants.find((g) => g.permission_key === key);
                const on = Boolean(grant);
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-sm"
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setDraftGrants((prev) => [
                              ...prev,
                              { permission_key: key, scope: "all" },
                            ]);
                          } else {
                            setDraftGrants((prev) =>
                              prev.filter((g) => g.permission_key !== key),
                            );
                          }
                        }}
                      />
                      <span className="min-w-0 break-all">
                        {key}
                        {NOOP_KEYS.has(key) ? (
                          <span className="ml-2 font-fine text-[10px] text-cadence-red">
                            not yet in effect
                          </span>
                        ) : null}
                      </span>
                    </label>
                    {on ? (
                      <Select
                        aria-label={`Scope for ${key}`}
                        value={grant?.scope ?? "all"}
                        onChange={(e) => {
                          const scope = e.target.value as UserGrant["scope"];
                          setDraftGrants((prev) =>
                            prev.map((g) =>
                              g.permission_key === key ? { ...g, scope } : g,
                            ),
                          );
                        }}
                        className="!h-8 !w-auto shrink-0"
                      >
                        <option value="own">own</option>
                        <option value="assigned">assigned</option>
                        <option value="all">all</option>
                      </Select>
                    ) : null}
                  </div>
                );
              })}
              <Button
                className="mt-3 sticky bottom-0"
                onClick={async () => {
                  try {
                    await putPermissions(editingId, draftGrants);
                    setEditingId(null);
                    await queryClient.invalidateQueries({ queryKey: userKeys.all });
                  } catch (err) {
                    setError(messageFrom(err));
                  }
                }}
              >
                Save permissions
              </Button>
            </div>
          )}
        </Dialog>
      ) : null}

      <Dialog
        open={Boolean(resetUserId)}
        onClose={() => setResetUserId(null)}
        title="Set user password"
      >
        <p className="text-sm text-on-card-muted">
          Applies to staff (email login) and workers (username login). They sign in with the same{" "}
          <code className="text-xs">POST /api/v1/auth/login/</code> endpoint.
        </p>
        <div className="mt-4">
          <Field label="New password" htmlFor="reset-password">
            <Input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
            />
          </Field>
        </div>
        <Button
          className="mt-4"
          onClick={async () => {
            if (!resetUserId || !resetPassword.trim()) {
              setError("Enter a password.");
              return;
            }
            try {
              setError(null);
              await resetUserCredentials(resetUserId, resetPassword);
              setResetUserId(null);
              setResetPassword("");
            } catch (err) {
              setError(messageFrom(err));
            }
          }}
        >
          Save password
        </Button>
      </Dialog>
      {confirmDialog}
    </PageScrollRegion>
    </PageFrame>
  );
}
