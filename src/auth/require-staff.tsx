"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { rememberNextPath } from "@/auth/next-path";
import { useSession } from "@/auth/session-context";
import { BackendDownScreen, StatusScreen } from "@/auth/status-screen";
import { Loading } from "@/shared/ui/Loading";

/**
 * A worker who opens a staff URL is sent to the portal (ARCHITECTURE.md
 * §2.4). This is UX only — every API call re-checks server-side regardless
 * (§2.3: hidden buttons are not security).
 */
export function RequireStaff({ children }: { children: ReactNode }) {
  const { session, isLoading, isSignedOut, isError, isUnavailable } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const isWorker = session?.user.user_type === "worker";

  useEffect(() => {
    if (isLoading || isError) return;
    if (isSignedOut) {
      const target = pathname + window.location.search;
      rememberNextPath(target);
      router.replace(`/login?next=${encodeURIComponent(target)}`);
    } else if (isWorker) {
      router.replace("/portal");
    }
  }, [isLoading, isError, isSignedOut, isWorker, router, pathname]);

  if (isLoading) return <Loading fullScreen />;
  if (isUnavailable || isError) return <BackendDownScreen />;
  if (isSignedOut) return <StatusScreen title="Redirecting to sign in…" />;
  if (!session || isWorker) return <StatusScreen title="Redirecting…" />;

  return <>{children}</>;
}
