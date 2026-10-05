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

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * A `datetime-local` value ("YYYY-MM-DDTHH:mm", wall-clock in the ORG's
 * timezone) -> UTC ISO string. Returns "" for blank/unparseable input.
 */
export function orgLocalToUtcIso(local: string, timeZone: string): string {
  const m = LOCAL_INPUT.exec(local);
  if (!m) return "";
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes so a DST boundary between the guess and the answer settles.
  let guess = wall - zoneOffsetMs(wall, timeZone);
  guess = wall - zoneOffsetMs(guess, timeZone);
  return new Date(guess).toISOString();
}

/** API ISO instant -> "YYYY-MM-DDTHH:mm" wall-clock in the org timezone, for a
 * `datetime-local` input. Returns "" for blank input. */
export function utcIsoToOrgLocal(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Wall-clock "HH:MM:SS" API times shown as "09:00–17:00" (no seconds). */
export function formatTimeRange(start: string | null | undefined, end: string | null | undefined): string {
  const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "—");
  return `${hhmm(start)}–${hhmm(end)}`;
}
