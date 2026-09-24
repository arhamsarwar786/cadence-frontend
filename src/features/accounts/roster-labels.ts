import { matchDemoStaffProfile } from "@/features/accounts/demo-staff-profiles";
import type { StaffUser } from "@/features/accounts/types";

export function accessLabelsForUser(
  user: StaffUser,
  grantKeys: string[] | undefined,
): string[] {
  if (user.is_root) {
    return ["Organization root"];
  }
  if (user.user_type === "worker") {
    return ["Worker portal"];
  }
  if (grantKeys === undefined) {
    return [];
  }
  const sorted = [...grantKeys].sort();
  if (sorted.length === 0) {
    if (user.status === "invited") {
      return ["Invited — no permissions yet"];
    }
    return ["Staff — no permissions assigned"];
  }
  const demo = matchDemoStaffProfile(sorted);
  if (demo) {
    return [`Demo ${demo.label}`, `${sorted.length} permissions`];
  }
  const shown = sorted.slice(0, 6);
  const labels = [...shown];
  const remaining = sorted.length - shown.length;
  if (remaining > 0) {
    labels.push(`+${remaining} more`);
  }
  return labels;
}

export function rosterPrimaryLogin(
  user: StaffUser,
  grantKeys: string[] | undefined,
): { primary: string; secondary: string | null } {
  if (user.user_type === "worker") {
    return {
      primary: user.login_masked ?? "Worker account",
      secondary: null,
    };
  }

  if (grantKeys) {
    const demo = matchDemoStaffProfile(grantKeys);
    if (demo) {
      return {
        primary: demo.email,
        secondary: user.login_masked,
      };
    }
  }

  return {
    primary: user.login_masked ?? user.id,
    secondary: null,
  };
}

export function rosterPrimaryLoginForRow(
  user: StaffUser,
  grantKeys: string[] | undefined,
  sessionUserId: string | undefined,
  sessionLogin: string | undefined,
): { primary: string; secondary: string | null } {
  if (sessionUserId && user.id === sessionUserId && sessionLogin) {
    return { primary: sessionLogin, secondary: user.login_masked };
  }
  if (user.is_root) {
    const primary =
      sessionUserId && user.id === sessionUserId && sessionLogin
        ? sessionLogin
        : (user.login_masked ?? "Organization root");
    const secondary =
      sessionUserId && user.id === sessionUserId && sessionLogin ? user.login_masked : null;
    return { primary, secondary };
  }
  return rosterPrimaryLogin(user, grantKeys);
}
