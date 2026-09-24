import type { ReactNode } from "react";
import { RequireStaff } from "@/auth/require-staff";
import { StaffShell } from "./_components/StaffShell";

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <RequireStaff>
      <StaffShell>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </StaffShell>
    </RequireStaff>
  );
}
