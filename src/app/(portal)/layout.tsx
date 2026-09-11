import type { ReactNode } from "react";
import { RequirePortal } from "@/auth/require-portal";
import { PortalShell } from "./_components/PortalShell";

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <RequirePortal>
      <PortalShell>{children}</PortalShell>
    </RequirePortal>
  );
}
