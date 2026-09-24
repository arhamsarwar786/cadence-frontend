import type { StaffUser } from "@/features/accounts/types";

export interface UserGrantRow {
  permission_key: string;
  scope: "own" | "assigned" | "all";
}

/** Readable access summary from GET …/permissions/ (frontend-only roster aid). */
export function summarizeUserAccess(
  user: Pick<StaffUser, "is_root" | "user_type" | "status">,
  grants: UserGrantRow[] | undefined,
): string[] {
  if (user.is_root) return ["Organization root"];
  if (user.user_type === "worker") return ["Worker portal"];
  if (!grants) return [];
  if (grants.length === 0) {
    if (user.status === "invited") return ["Invited — no permissions yet"];
    return ["Staff — no permissions assigned"];
  }
  const keys = [...grants.map((g) => g.permission_key)].sort();
  const shown = keys.slice(0, 6);
  const labels = [...shown];
  const remaining = keys.length - shown.length;
  if (remaining > 0) labels.push(`+${remaining} more`);
  return labels;
}

const KNOWN_LOGINS_KEY = "cadence.admin.known-user-logins";

export function readKnownUserLogins(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KNOWN_LOGINS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

export function rememberUserLogin(userId: string, login: string): void {
  if (typeof window === "undefined" || !userId || !login.trim()) return;
  const map = readKnownUserLogins();
  map[userId] = login.trim();
  window.localStorage.setItem(KNOWN_LOGINS_KEY, JSON.stringify(map));
}
