/**
 * The one fetch wrapper (ARCHITECTURE.md §2.5). Same-origin, session cookie
 * + CSRF — no auth header, no token storage. Every feature's api.ts /
 * actions.ts goes through this; pages never call fetch directly.
 */

const CSRF_COOKIE_NAME = "csrftoken";
const CSRF_HEADER_NAME = "X-CSRFToken";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

/** The session provider registers this so any 401 on a data call (expired
 * session) signs the user out and the route guards redirect to /login. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(defaultMessage(status, body));
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function defaultMessage(status: number, body: unknown): string {
  if (status === 0) {
    return typeof body === "string" && body.trim()
      ? body.trim()
      : "Can't reach the API. Is the backend running?";
  }
  const fromBody = extractDetail(body);
  if (fromBody) return fromBody;
  return `Request failed with status ${status}`;
}

function extractDetail(body: unknown): string | null {
  if (typeof body === "string" && body.trim() && !/^\s*</.test(body)) {
    return body.trim().slice(0, 500);
  }
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const record = body as Record<string, unknown>;
    for (const key of ["detail", "non_field_errors", "__all__", "error", "message"] as const) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim();
      if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
        const joined = value.join(" ").trim();
        if (joined) return joined;
      }
    }
  }
  return null;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Override the default budget (20s JSON, 120s uploads). */
  timeoutMs?: number;
  /** "blob" returns the raw body of a 2xx (file doors); errors still parse. */
  responseType?: "json" | "blob";
}

/**
 * The DRF pagination envelope (ARCHITECTURE.md §4): every tenant-sized list
 * comes back shaped like this, never a bare array.
 */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Follow `next` until every row is loaded. For pickers and work queues, where a
 * row past the first page silently vanishing is worse than one extra request. */
export async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<Paginated<T> | T[]>,
): Promise<Paginated<T>> {
  const first = await fetchPage(1);
  if (Array.isArray(first)) return { count: first.length, next: null, previous: null, results: first };
  const results = [...first.results];
  let next = first.next;
  for (let page = 2; next && page <= 50; page++) {
    const more = await fetchPage(page);
    if (Array.isArray(more)) break;
    results.push(...more.results);
    next = more.next;
  }
  return { count: first.count, next: null, previous: null, results };
}

/** DRF list doors return a pagination envelope; a few catalogs return a bare array. */
export function normalizeList<T>(data: Paginated<T> | T[] | null | undefined): T[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === "object" && Array.isArray(data.results)) return data.results;
  return [];
}

/** Doors whose 401/403 is NOT "your session expired mid-action": a wrong
 * password on login, the logout POST itself, and the /auth/me probe (the
 * session query reads that answer itself — signalling here would loop). */
const SESSION_PROBE_PATHS = ["/api/v1/auth/login/", "/api/v1/auth/logout/", "/api/v1/auth/me/"];

/** DRF's NotAuthenticated detail. Session auth has no WWW-Authenticate
 * header, so DRF answers an anonymous caller 403 (not 401) with this text —
 * the only way to tell "signed out" from "signed in but not allowed". */
const NOT_AUTHENTICATED_DETAIL = "Authentication credentials were not provided.";

function detailOf(body: unknown): string | null {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const detail = (body as Record<string, unknown>).detail;
    if (typeof detail === "string") return detail.trim();
  }
  return null;
}

/** True when the response says the caller has no session at all. */
export function isSessionGone(status: number, body: unknown): boolean {
  if (status === 401) return true;
  return status === 403 && detailOf(body) === NOT_AUTHENTICATED_DETAIL;
}

function isCsrfFailure(body: unknown): boolean {
  return /^CSRF Failed/i.test(detailOf(body) ?? "");
}

async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers, responseType = "json", ...rest } = options;
  const finalHeaders = new Headers(headers);
  finalHeaders.set("Accept", "application/json");

  let finalBody: BodyInit | undefined;
  if (body instanceof FormData) {
    // Multipart uploads: never set Content-Type ourselves — the browser
    // must generate the boundary, and a hand-set header here breaks it.
    finalBody = body;
  } else if (body !== undefined) {
    finalHeaders.set("Content-Type", "application/json");
    finalBody = JSON.stringify(body);
  }

  if (!SAFE_METHODS.has(method.toUpperCase())) {
    // No CSRF cookie usually means the whole cookie jar is gone (session
    // expired / cleared). Send anyway: Django answers "not authenticated"
    // for a dead session (-> the sign-out path below) or "CSRF Failed" for
    // a live one (-> the friendly refresh message), and both are truthful.
    const csrfToken = readCookie(CSRF_COOKIE_NAME);
    if (csrfToken) finalHeaders.set(CSRF_HEADER_NAME, csrfToken);
  }

  const timeoutMs =
    rest.timeoutMs ?? (finalBody instanceof FormData ? 120_000 : 20_000);
  const { timeoutMs: _ignored, ...fetchRest } = rest;

  let response: Response;
  try {
    response = await fetch(path, {
      ...fetchRest,
      method,
      headers: finalHeaders,
      body: finalBody,
      credentials: "include",
      signal: rest.signal ?? AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    throw new ApiError(
      0,
      aborted
        ? "Can't reach the API (timed out). Is the backend running?"
        : "Can't reach the API. Is the backend running?",
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (responseType === "blob" && response.ok) {
    return (await response.blob()) as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const data: unknown = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    if (isSessionGone(response.status, data) && !SESSION_PROBE_PATHS.some((p) => path.includes(p))) {
      onUnauthorized?.();
    }
    if (response.status === 403 && isCsrfFailure(data)) {
      throw new ApiError(403, "Missing security token. Refresh the page and try again.");
    }
    throw new ApiError(response.status, data);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, options?: ApiRequestOptions) =>
    apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: ApiRequestOptions) =>
    apiFetch<T>(path, { ...options, method: "DELETE" }),
};
