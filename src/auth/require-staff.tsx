"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/auth/session-context";

/**
 * A worker who opens a staff URL is sent to the portal (ARCHITECTURE.md
 * §2.4). This is UX only — every API call re-checks server-side regardless
 * (§2.3: hidden buttons are not security).
 */
export function RequireStaff({ children }: { children: ReactNode }) {
  const { session, isLoading, isSignedOut } = useSession();
  const router = useRouter();
  const isWorker = session?.user.user_type === "worker";

  useEffect(() => {
    if (isLoading) return;
    if (isSignedOut) {
      router.replace("/login");
    } else if (isWorker) {
      router.replace("/portal");
    }
  }, [isLoading, isSignedOut, isWorker, router]);

  if (isLoading || isSignedOut || !session || isWorker) return null;

  return <>{children}</>;
}
