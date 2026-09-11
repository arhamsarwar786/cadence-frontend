"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/auth/session-context";

/**
 * A staff user who opens a portal URL is sent to staff home
 * (ARCHITECTURE.md §2.4). UX only, same caveat as require-staff.tsx.
 */
export function RequirePortal({ children }: { children: ReactNode }) {
  const { session, isLoading, isSignedOut } = useSession();
  const router = useRouter();
  const isStaff = session?.user.user_type === "staff";

  useEffect(() => {
    if (isLoading) return;
    if (isSignedOut) {
      router.replace("/login");
    } else if (isStaff) {
      router.replace("/");
    }
  }, [isLoading, isSignedOut, isStaff, router]);

  if (isLoading || isSignedOut || !session || isStaff) return null;

  return <>{children}</>;
}
