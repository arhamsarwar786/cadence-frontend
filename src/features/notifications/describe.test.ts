import { describe, expect, it } from "vitest";
import { badgeCount, collapseInbox, describeNotification, isUnread } from "@/features/notifications/describe";
import type { InboxNotification } from "@/features/notifications/types";

describe("describeNotification", () => {
  it("words an e-sign notice and deep-links per audience", () => {
    const row = {
      type: "esign" as const,
      payload: { org_name: "Acme Staffing", document_label: "your contract", expires_on: "2026-10-20" },
    };
    const portal = describeNotification(row, "portal");
    expect(portal.title).toBe("Signature requested");
    expect(portal.body).toBe("Acme Staffing sent you your contract to sign, by 2026-10-20.");
    expect(portal.href).toBe("/portal/signatures");
    expect(describeNotification(row, "staff").href).toBe("/esign");
  });

  it("words the staff disposal notice with a count", () => {
    const one = describeNotification(
      { type: "data_disposal", payload: { record_count: "1", due_on: "2026-11-01" } },
      "staff",
    );
    expect(one.body).toBe("1 departed worker record will be destroyed on 2026-11-01.");
    expect(one.href).toBe("/privacy/disposal");
    const many = describeNotification({ type: "data_disposal", payload: { record_count: "3" } }, "staff");
    expect(many.body).toBe("3 departed worker records will be destroyed soon.");
  });

  it("survives a missing or odd payload", () => {
    expect(describeNotification({ type: "shift_offer", payload: null }, "portal").body).toBe("a placement.");
    expect(describeNotification({ type: "invoice", payload: [] }, "portal").href).toBeUndefined();
  });
});

describe("inbox helpers", () => {
  it("only a delivered row is unread", () => {
    expect(isUnread({ status: "sent" })).toBe(true);
    expect(isUnread({ status: "read" })).toBe(false);
    expect(isUnread({ status: "queued" })).toBe(false);
  });

  it("caps the badge", () => {
    expect(badgeCount(3)).toBe("3");
    expect(badgeCount(12)).toBe("9+");
  });
});

describe("collapseInbox", () => {
  const row = (id: string, channel: InboxNotification["channel"], status: InboxNotification["status"], requestId?: string): InboxNotification => ({
    id,
    type: "esign",
    channel,
    status,
    payload: requestId ? { request_id: requestId } : {},
    sent_at: "2026-10-01T10:00:00Z",
    created_at: "2026-10-01T10:00:00Z",
  });

  it("folds the email and in-app copies of one request into one entry, worded from the in-app row", () => {
    const entries = collapseInbox([row("e1", "email", "sent", "R1"), row("a1", "in_app", "read", "R1"), row("x", "in_app", "sent")]);
    expect(entries).toHaveLength(2);
    expect(entries[0].row.id).toBe("a1");
    expect(entries[0].ids).toEqual(["e1", "a1"]);
    expect(entries[0].unreadIds).toEqual(["e1"]);
    expect(entries[0].unread).toBe(true);
    expect(entries[1].key).toBe("row:x");
  });
});
