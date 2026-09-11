"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { ApiError } from "@/api/client";
import { getMe } from "@/features/accounts/api";
import type { CurrentSession } from "@/features/accounts/types";

export const SESSION_QUERY_KEY = ["session"] as const;

interface SessionContextValue {
  session: CurrentSession | undefined;
  isLoading: boolean;
  /** True once the fetch has settled and the caller is NOT signed in
   * (401/403 from /auth/me — ARCHITECTURE.md §10: 401 -> redirect to
   * /login). A different failure (network, 5xx) is not treated as
   * "signed out" and is surfaced as isError instead. */
  isSignedOut: boolean;
  isError: boolean;
  /** Call after LOGIN so every consumer re-reads the same fetch instead
   * of guessing the new session client-side. */
  refresh: () => Promise<unknown>;
  /** Call after LOGOUT instead of refresh(): it marks the session
   * confirmed-absent synchronously rather than re-fetching. A post-logout
   * REFETCH of /auth/me races the next page's mount — under rapid
   * navigation (logout -> /login -> a fresh login), a component reading
   * the query before that refetch resolves, or a remounting guard
   * triggering its own overlapping refetch, can briefly observe the
   * previous session again. Proven in browser testing: an infinite
   * /login <-> /portal redirect loop switching users. Logout already
   * knows there is no session; nothing to ask the server to confirm. */
  clear: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const query = useQuery<CurrentSession | null>({
    queryKey: SESSION_QUERY_KEY,
    queryFn: getMe,
    retry: false,
    staleTime: 60_000,
    // The session only ever changes through our own explicit login/
    // logout actions (refresh()/clear() below) — never behind our back.
    // Refetching just because a guard component remounted (the App
    // Router default) is exactly the extra, overlapping request that
    // raced the logout-clear fix above; there is nothing to gain by
    // re-asking the server on every mount.
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const isSignedOut =
    query.data === null ||
    (query.isError &&
      query.error instanceof ApiError &&
      (query.error.status === 401 || query.error.status === 403));

  const value = useMemo<SessionContextValue>(
    () => ({
      session: query.data ?? undefined,
      isLoading: query.isLoading,
      isSignedOut,
      isError: query.isError && !isSignedOut,
      refresh: () => queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY }),
      clear: () => queryClient.setQueryData(SESSION_QUERY_KEY, null),
    }),
    [query.data, query.isLoading, query.isError, isSignedOut, queryClient],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
