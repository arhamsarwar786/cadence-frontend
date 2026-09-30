const NEXT_KEY = "cadence.nextPath";

/** Same-origin absolute path only ("/tasks?x=1"); anything else (full URLs,
 * "//host", "/\host", non-staff auth pages) is rejected to avoid open redirects. */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  if (/[\u0000-\u001f]/.test(raw) || raw.startsWith("/login")) return null;
  return raw;
}

/** Remember the page a signed-out visitor asked for so login can return there. */
export function rememberNextPath(path: string): void {
  const safe = safeNextPath(path);
  if (!safe) return;
  try {
    sessionStorage.setItem(NEXT_KEY, safe);
  } catch {
    // storage unavailable — the ?next= param still carries it
  }
}

/** Read (and clear) the post-login destination: ?next= first, then the stored one. */
export function takeNextPath(): string | null {
  let stored: string | null = null;
  try {
    stored = sessionStorage.getItem(NEXT_KEY);
    sessionStorage.removeItem(NEXT_KEY);
  } catch {
    // ignore
  }
  const fromQuery = new URLSearchParams(window.location.search).get("next");
  return safeNextPath(fromQuery) ?? safeNextPath(stored);
}
