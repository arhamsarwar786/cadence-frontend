/**
 * The one fetch wrapper (ARCHITECTURE.md §2.5). Same-origin, session cookie
 * + CSRF — no auth header, no token storage. Every feature's api.ts /
 * actions.ts goes through this; pages never call fetch directly.
 */

const CSRF_COOKIE_NAME = "csrftoken";
const CSRF_HEADER_NAME = "X-CSRFToken";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(
      status === 0
        ? typeof body === "string"
          ? body
          : "Can't reach the API. Is the backend running?"
        : `Request failed with status ${status}`,
    );
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
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

async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers, ...rest } = options;
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
    const csrfToken = readCookie(CSRF_COOKIE_NAME);
    if (csrfToken) {
      finalHeaders.set(CSRF_HEADER_NAME, csrfToken);
    } else if (!path.includes("/api/v1/auth/login/")) {
      // Logout (and every other unsafe call) needs the CSRF header once a
      // session exists. Login is the one public POST that may run before
      // the cookie is issued.
      throw new ApiError(
        0,
        "Missing security token. Refresh the page and try again.",
      );
    }
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

  const contentType = response.headers.get("content-type") ?? "";
  const data: unknown = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
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
