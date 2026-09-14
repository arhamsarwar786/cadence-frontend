import { describe, expect, it } from "vitest";
import { hasAnyPerm, hasPerm } from "@/permissions/has-perm";
import { PERM } from "@/permissions/keys";
import type { CurrentUser } from "@/features/accounts/types";

function staff(grants: CurrentUser["grants"], extras: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: "1",
    login: "recruiter@example.com",
    user_type: "staff",
    is_root: false,
    grants,
    ...extras,
  } as CurrentUser;
}

describe("hasPerm", () => {
  it("root always passes", () => {
    const user = staff([], { is_root: true });
    expect(hasPerm(user, PERM.CLIENTS_CREATE)).toBe(true);
  });

  it("workers never hold catalog grants", () => {
    const user = staff([{ key: PERM.CLIENTS_VIEW, scopes: ["all"] }], {
      user_type: "worker",
    });
    expect(hasPerm(user, PERM.CLIENTS_VIEW)).toBe(false);
  });

  it("missing key is omitted, not greying", () => {
    const user = staff([{ key: PERM.CLIENTS_VIEW, scopes: ["all"] }]);
    expect(hasPerm(user, PERM.CLIENTS_VIEW)).toBe(true);
    expect(hasPerm(user, PERM.CLIENTS_CREATE)).toBe(false);
  });

  it("hasAnyPerm is true if one of the invoice keys is held", () => {
    const user = staff([{ key: PERM.INVOICES_SEND, scopes: ["all"] }]);
    expect(hasAnyPerm(user, [PERM.CLIENTS_INVOICE_EDIT, PERM.INVOICES_SEND])).toBe(true);
    expect(hasAnyPerm(user, [PERM.CLIENTS_INVOICE_APPROVE])).toBe(false);
  });
});
