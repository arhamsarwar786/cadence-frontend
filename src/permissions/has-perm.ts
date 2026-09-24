import type { CurrentUser, Scope } from "@/features/accounts/types";
import type { PermissionKey } from "@/permissions/keys";

const SCOPE_RANK: Record<Scope, number> = { own: 0, assigned: 1, all: 2 };

type GrantHolder = Pick<CurrentUser, "is_root" | "grants" | "user_type">;

/**
 * Client-side mirror of accounts.permissions.has_perm (own < assigned <
 * all). For NAV and enabled/disabled affordances ONLY — the API re-checks
 * every write itself; a hidden or shown button is never the real gate
 * (ARCHITECTURE.md §2.3).
 */
export function hasPerm(user: GrantHolder, key: PermissionKey, scope?: Scope): boolean {
  if (user.user_type === "worker") return false;
  if (user.is_root) return true;
  const grants = user.grants ?? [];
  const grant = grants.find((g) => g.key === key);
  if (!grant) return false;
  if (!scope) return true;
  const scopes = grant.scopes ?? [];
  return scopes.some((held) => SCOPE_RANK[held] >= SCOPE_RANK[scope]);
}

/** Any one of the keys is held (at any scope) — for nav items gated by
 * "create OR approve OR send"-style access (ARCHITECTURE.md §6, Invoices). */
export function hasAnyPerm(user: GrantHolder, keys: readonly PermissionKey[]): boolean {
  return keys.some((key) => hasPerm(user, key));
}

export function grantScopesFor(user: GrantHolder, key: PermissionKey): Scope[] {
  if (user.user_type === "worker") return [];
  if (user.is_root) return ["all"];
  return (user.grants ?? []).find((g) => g.key === key)?.scopes ?? [];
}
