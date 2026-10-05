import type { InboxNotification } from "@/features/notifications/types";

export interface NotificationSummary {
  title: string;
  body: string;
  /** Where acting on it happens, when there is a screen for it. */
  href?: string;
  hrefLabel?: string;
}

function text(payload: unknown, key: string): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function plural(count: string, noun: string): string {
  const n = Number(count);
  return `${count || "Some"} ${noun}${n === 1 ? "" : "s"}`;
}

/**
 * The human face of one notification row. The API serves the row's type and
 * payload (the facts the template rendered from), not the rendered text, so
 * the inbox words it here. `audience` picks the deep link: a worker acts in
 * the portal, staff act in the office screens.
 */
export function describeNotification(
  row: Pick<InboxNotification, "type" | "payload">,
  audience: "staff" | "portal",
): NotificationSummary {
  const p = row.payload;
  const org = text(p, "org_name");
  switch (row.type) {
    case "esign": {
      const label = text(p, "document_label") || "a document";
      const by = text(p, "expires_on");
      return {
        title: "Signature requested",
        body: `${org || "Your agency"} sent you ${label} to sign${by ? `, by ${by}` : ""}.`,
        href: audience === "portal" ? "/portal/signatures" : "/esign",
        hrefLabel: audience === "portal" ? "Open signatures" : "Open e-signatures",
      };
    }
    case "shift_offer": {
      const job = text(p, "job_title") || "a placement";
      const client = text(p, "client_name");
      const start = text(p, "start_date");
      const count = text(p, "shift_count");
      return {
        title: "New shift offer",
        body: `${job}${client ? ` at ${client}` : ""}${start ? ` from ${start}` : ""}${
          count ? ` · ${plural(count, "shift")}` : ""
        }.`,
        href: audience === "portal" ? "/portal/offers" : "/jobs",
        hrefLabel: audience === "portal" ? "Review offers" : "Open jobs",
      };
    }
    case "assignment": {
      const worker = text(p, "worker_name") || "A worker";
      const job = text(p, "job_title") || "the placement";
      const start = text(p, "start_date");
      return {
        title: "Worker confirmed",
        body: `${worker} is confirmed for ${job}${start ? ` from ${start}` : ""}.`,
        href: audience === "staff" ? "/jobs" : undefined,
        hrefLabel: "Open jobs",
      };
    }
    case "invoice": {
      const number = text(p, "invoice_number");
      const total = text(p, "total");
      const due = text(p, "due_date");
      return {
        title: number ? `Invoice ${number}` : "Invoice issued",
        body: [total && `Total ${total}`, due && `due ${due}`].filter(Boolean).join(", ") || "An invoice was issued.",
        href: audience === "staff" ? "/invoices" : undefined,
        hrefLabel: "Open invoices",
      };
    }
    case "credit_note": {
      const number = text(p, "credit_note_number");
      const invoice = text(p, "invoice_number");
      return {
        title: number ? `Credit note ${number}` : "Credit note issued",
        body: invoice ? `Against invoice ${invoice}.` : "A credit note was issued.",
        href: audience === "staff" ? "/credit-notes" : undefined,
        hrefLabel: "Open credit notes",
      };
    }
    case "data_disposal": {
      const count = text(p, "record_count");
      const due = text(p, "due_on");
      return {
        title: "Personal data due for destruction",
        body: `${plural(count, "departed worker record")} will be destroyed${due ? ` on ${due}` : " soon"}.`,
        href: audience === "staff" ? "/privacy/disposal" : undefined,
        hrefLabel: "Review disposal",
      };
    }
    case "cert_expiry":
      return { title: "Certification expiring", body: "A certification is close to its expiry date." };
    case "task":
      return { title: "Task", body: "A task needs your attention.", href: audience === "staff" ? "/tasks" : undefined, hrefLabel: "Open tasks" };
    default:
      return { title: "Notification", body: "You have a new notification." };
  }
}

/** Delivered and not yet acknowledged. */
export function isUnread(row: Pick<InboxNotification, "status">): boolean {
  return row.status === "sent";
}

/** "9+" past nine — the badge is a nudge, not a ledger. */
export function badgeCount(n: number): string {
  return n > 9 ? "9+" : String(n);
}

/** One notice as the inbox shows it. The queue writes one row PER CHANNEL
 * (an e-sign request lands as an email row and a portal row), so rows that
 * carry the same act collapse into one entry; marking it read acknowledges
 * every delivered copy. */
export interface InboxEntry {
  key: string;
  /** The row the entry is worded from — the in-app copy when there is one. */
  row: InboxNotification;
  /** Every row id the entry stands for. */
  ids: string[];
  /** Delivered-but-unread copies (what Mark read sends). */
  unreadIds: string[];
  unread: boolean;
}

const SUBJECT_KEYS = ["request_id", "assignment_id", "invoice_id", "credit_note_id"] as const;

function subjectKey(row: InboxNotification): string {
  for (const key of SUBJECT_KEYS) {
    const value = text(row.payload, key);
    if (value) return `${row.type}:${value}`;
  }
  return `row:${row.id}`;
}

/** Collapse per-channel copies of one notice; keeps the incoming order
 * (newest first from the API). */
export function collapseInbox(rows: InboxNotification[]): InboxEntry[] {
  const entries = new Map<string, InboxEntry>();
  for (const row of rows) {
    const key = subjectKey(row);
    const existing = entries.get(key);
    if (!existing) {
      entries.set(key, {
        key,
        row,
        ids: [row.id],
        unreadIds: isUnread(row) ? [row.id] : [],
        unread: isUnread(row),
      });
      continue;
    }
    existing.ids.push(row.id);
    if (isUnread(row)) {
      existing.unreadIds.push(row.id);
      existing.unread = true;
    }
    if (row.channel === "in_app" && existing.row.channel !== "in_app") existing.row = row;
  }
  return [...entries.values()];
}
