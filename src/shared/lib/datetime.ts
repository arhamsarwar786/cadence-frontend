/**
 * Shift times, hour-sheet dates and every other schedule-facing datetime
 * are local to the ORG's timezone (cadence-schema.md §1 `organizations.
 * timezone`), not the browser's. Every call site passes the org timezone
 * from session — this module never assumes one.
 */

export function formatDate(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone }).format(new Date(iso));
}

export function formatDateTime(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(iso));
}

export function formatTime(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-CA", { timeStyle: "short", timeZone }).format(new Date(iso));
}
