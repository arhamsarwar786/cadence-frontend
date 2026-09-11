"use client";

import { useSession } from "@/auth/session-context";

/**
 * Staff home (ARCHITECTURE.md §7: "open tasks / work queue"). The real
 * work-queue content lands with the tasks feature (build order step 10);
 * this is the shell's landing screen until then.
 */
export default function StaffHomePage() {
  const { session } = useSession();

  return (
    <div>
      <h1 className="font-heading text-3xl text-cadence-ink">
        Welcome{session ? `, ${session.user.login}` : ""}
      </h1>
      <p className="mt-2 font-body text-sm text-cadence-ink/70">
        Your open tasks and work queue will appear here.
      </p>
    </div>
  );
}
