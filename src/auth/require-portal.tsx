"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/auth/session-context";
import { BackendDownScreen, StatusScreen } from "@/auth/status-screen";

/**
 * A staff user who opens a portal URL is sent to staff home
 * (ARCHITECTURE.md §2.4). UX only, same caveat as require-staff.tsx.
 */
export function RequirePortal({ children }: { children: ReactNode }) {
  const { session, isLoading, isSignedOut, isError, isUnavailable } = useSession();
  const router = useRouter();
  const isStaff = session?.user.user_type === "staff";

  useEffect(() => {
    if (isLoading || isError) return;
    if (isSignedOut) {
      router.replace("/login");
    } else if (isStaff) {
      router.replace("/");
    }
  }, [isLoading, isError, isSignedOut, isStaff, router]);

  if (isLoading) return <StatusScreen title="Loading…" />;
  if (isUnavailable || isError) return <BackendDownScreen />;
  if (isSignedOut) return <StatusScreen title="Redirecting to sign in…" />;
  if (!session || isStaff) return <StatusScreen title="Redirecting…" />;

  return <>{children}</>;
}
