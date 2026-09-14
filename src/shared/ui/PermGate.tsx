"use client";

import type { ReactNode } from "react";
import { useSession } from "@/auth/session-context";
import { hasAnyPerm, hasPerm } from "@/permissions/has-perm";
import type { PermissionKey } from "@/permissions/keys";

/** Hide create/act chrome the caller cannot use. The API still re-checks. */
export function PermGate({
  anyOf,
  children,
}: {
  anyOf: PermissionKey | readonly PermissionKey[];
  children: ReactNode;
}) {
  const { session } = useSession();
  if (!session) return null;
  const keys = Array.isArray(anyOf) ? anyOf : [anyOf];
  if (!hasAnyPerm(session.user, keys)) return null;
  return <>{children}</>;
}

export function useCanAct(anyOf: PermissionKey | readonly PermissionKey[]): boolean {
  const { session } = useSession();
  if (!session) return false;
  const keys = Array.isArray(anyOf) ? anyOf : [anyOf];
  return hasAnyPerm(session.user, keys);
}

export function useHasPerm(key: PermissionKey): boolean {
  const { session } = useSession();
  if (!session) return false;
  return hasPerm(session.user, key);
}
