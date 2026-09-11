import type { ReactNode } from "react";
import { RequireStaff } from "@/auth/require-staff";
import { StaffShell } from "./_components/StaffShell";

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <RequireStaff>
      <StaffShell>{children}</StaffShell>
    </RequireStaff>
  );
}
