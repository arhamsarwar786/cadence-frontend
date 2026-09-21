"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/api/client";
import { listUsers, userKeys } from "@/features/accounts/api";
import { PERM, type PermissionKey } from "@/permissions/keys";
import { messageFrom } from "@/shared/lib/errors";
import {
  Button,
  Dialog,
  Field,
  Input,
  ListSkeleton,
  PageHeader,
  PermGate,
  Select,
  useConfirm,
} from "@/shared/ui";

interface UserGrant {
  permission_key: string;
  scope: "own" | "assigned" | "all";
}

function inviteUser(email: string): Promise<{ id: string; token?: string }> {
  return api.post("/api/v1/auth/users/invite/", { email });
}

function deactivateUser(id: string): Promise<void> {
  return api.post(`/api/v1/auth/users/${id}/deactivate/`);
}

function resetCredentials(id: string): Promise<void> {
  return api.post(`/api/v1/auth/users/${id}/reset-credentials/`);
}

function getPermissions(id: string): Promise<UserGrant[]> {
  return api.get(`/api/v1/auth/users/${id}/permissions/`);
}

function putPermissions(id: string, grants: UserGrant[]): Promise<UserGrant[]> {
  return api.put(`/api/v1/auth/users/${id}/permissions/`, { grants });
}

const CATALOG = Object.values(PERM) as PermissionKey[];
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

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: userKeys.list({ pageSize: 200 }),
    queryFn: async () => {
      const data = await listUsers({ pageSize: 200 });
      return Array.isArray(data) ? data : data.results;
    },
  });

  const permsQuery = useQuery({
    queryKey: userKeys.detail(editingId ?? ""),
    queryFn: () => getPermissions(editingId!),
    enabled: Boolean(editingId),
  });

  const [draftGrants, setDraftGrants] = useState<UserGrant[]>([]);

  async function openEditor(id: string) {
    setEditingId(id);
    const data = await getPermissions(id);
    setDraftGrants(Array.isArray(data) ? data : []);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users & permissions"
        actions={
          <PermGate anyOf={PERM.ADMIN_USERS_CREATE}>
            <Button onClick={() => setInviteOpen(true)}>Invite user</Button>
          </PermGate>
        }
      />
      {error ? <p className="text-sm text-cadence-red">{error}</p> : null}
      {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError ? (
        <p className="text-sm text-cadence-red">{messageFrom(query.error)}</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {(query.data ?? []).map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-body text-sm font-medium">{u.login_masked}</p>
                <p className="font-fine text-[10px] uppercase text-cadence-ink/60">
                  {u.status}
                  {u.is_root ? " · root" : ""}
                </p>
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
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Reset credentials?",
                        body: "The user will need a new invite or password path.",
                        confirmLabel: "Reset",
                        danger: true,
                      });
                      if (!ok) return;
                      try {
                        await resetCredentials(u.id);
                      } catch (err) {
                        setError(messageFrom(err));
                      }
                    }}
                  >
                    Reset credentials
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
          ))}
        </ul>
      )}

      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite user">
        <Field label="Work email" htmlFor="invite-email">
          <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {inviteToken ? (
          <p className="mt-3 break-all rounded-xl bg-cadence-yellow/40 p-3 font-fine text-xs text-cadence-ink">
            Invite token (shown once): {inviteToken}
          </p>
        ) : null}
        <Button
          className="mt-4"
          onClick={async () => {
            setError(null);
            try {
              const res = await inviteUser(email);
              setInviteToken(res.token ?? null);
              await queryClient.invalidateQueries({ queryKey: userKeys.all });
            } catch (err) {
              setError(messageFrom(err));
            }
          }}
        >
          Send invite
        </Button>
      </Dialog>

      <Dialog
        open={Boolean(editingId)}
        onClose={() => setEditingId(null)}
        title="Permission editor"
      >
        {permsQuery.isLoading ? (
          <p className="text-sm">Loading…</p>
        ) : (
          <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
            {CATALOG.map((key) => {
              const grant = draftGrants.find((g) => g.permission_key === key);
              const on = Boolean(grant);
              return (
                <label
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <span>
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={on}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setDraftGrants([...draftGrants, { permission_key: key, scope: "all" }]);
                        } else {
                          setDraftGrants(draftGrants.filter((g) => g.permission_key !== key));
                        }
                      }}
                    />
                    {key}
                    {NOOP_KEYS.has(key) ? (
                      <span className="ml-2 font-fine text-[10px] text-cadence-red">
                        not yet in effect
                      </span>
                    ) : null}
                  </span>
                  {on ? (
                    <Select
                      value={grant?.scope ?? "all"}
                      onChange={(e) => {
                        const scope = e.target.value as UserGrant["scope"];
                        setDraftGrants(
                          draftGrants.map((g) =>
                            g.permission_key === key ? { ...g, scope } : g,
                          ),
                        );
                      }}
                      className="!h-8 !w-auto"
                    >
                      <option value="own">own</option>
                      <option value="assigned">assigned</option>
                      <option value="all">all</option>
                    </Select>
                  ) : null}
                </label>
              );
            })}
            <Button
              className="mt-3 sticky bottom-0"
              onClick={async () => {
                if (!editingId) return;
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
      {confirmDialog}
    </div>
  );
}
