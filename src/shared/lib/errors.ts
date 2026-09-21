import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "@/api/client";

/**
 * HTTP -> UI mapping (ARCHITECTURE.md §10). A cross-tenant or out-of-scope
 * id is 404, never a 403 that would confirm the row exists — this module
 * never invents a friendlier story for that distinction.
 */

const META_KEYS = new Set(["detail", "non_field_errors"]);

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export function isBadRequest(error: unknown): boolean {
  return error instanceof ApiError && error.status === 400;
}

export type FieldErrors = Record<string, string[]>;

function collectMessages(value: unknown, path = ""): string[] {
  if (value == null) return [];
  if (typeof value === "string") {
    const text = value.trim();
    return text ? [path ? `${path}: ${text}` : text] : [];
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return [path ? `${path}: ${String(value)}` : String(value)];
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return [];
    if (value.every((item) => typeof item === "string")) {
      const joined = value.map(String).join(" ").trim();
      return joined ? [path ? `${path}: ${joined}` : joined] : [];
    }
    return value.flatMap((item, index) =>
      collectMessages(item, path ? `${path}[${index}]` : `[${index}]`),
    );
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) =>
      collectMessages(nested, path ? `${path}.${key}` : key),
    );
  }
  return [];
}

function stringListMessage(value: unknown): string | null {
  const messages = collectMessages(value);
  return messages.length ? messages.join(" ") : null;
}

/** A 400's field errors for React Hook Form. Meta keys (`detail`,
 * `non_field_errors`) are excluded — those belong on the form banner. */
export function fieldErrorsFrom(error: unknown): FieldErrors {
  if (!(error instanceof ApiError) || error.status !== 400) return {};
  const body = error.body;
  if (body === null || typeof body !== "object" || Array.isArray(body)) return {};

  const fieldErrors: FieldErrors = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (META_KEYS.has(key)) continue;
    const messages = collectMessages(value)
      .map((message) => {
        const prefix = `${key}: `;
        return message.startsWith(prefix) ? message.slice(prefix.length) : message;
      })
      .filter(Boolean);
    if (messages.length) fieldErrors[key] = messages;
  }
  return fieldErrors;
}

function detailMessage(body: unknown): string | null {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return typeof body === "string" && body.trim() ? body.trim() : null;
  }
  const record = body as Record<string, unknown>;
  // Django ValidationError → {"detail": ["…"]}
  // DRF serializer cross-field → {"non_field_errors": ["…"]}
  return stringListMessage(record.detail) ?? stringListMessage(record.non_field_errors);
}

function fieldMessagesSummary(error: unknown, excludeKeys: readonly string[] = []): string | null {
  const exclude = new Set(excludeKeys);
  const parts: string[] = [];
  for (const [field, messages] of Object.entries(fieldErrorsFrom(error))) {
    if (exclude.has(field) || !messages[0]) continue;
    parts.push(`${field}: ${messages[0]}`);
  }
  return parts.length ? parts.join(" ") : null;
}

/**
 * Maps a 400's field errors onto a React Hook Form instance.
 * Returns a form-level message for anything not pinned to a known field
 * (`non_field_errors`, `detail`, unknown keys, nested leftovers). Null when
 * every API error landed on a rendered field.
 */
export function applyFieldErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  error: unknown,
  validKeys: readonly string[],
): string | null {
  const valid = new Set(validKeys);
  const applied: string[] = [];
  const unmatched: string[] = [];

  for (const [field, messages] of Object.entries(fieldErrorsFrom(error))) {
    if (!messages[0]) continue;
    if (valid.has(field)) {
      setError(field as Path<T>, { message: messages[0] });
      applied.push(field);
    } else {
      unmatched.push(`${field}: ${messages[0]}`);
    }
  }

  const meta =
    error instanceof ApiError ? detailMessage(error.body) : null;
  const residual = [meta, ...unmatched].filter(Boolean) as string[];
  if (residual.length) return residual.join(" ");
  if (applied.length) return null;
  return messageFrom(error);
}

/** True when Django is down, the proxy timed out, or the response is a 5xx.
 * Guards must not treat this as signed-out (ARCHITECTURE.md §10: only
 * 401/403 mean that) — but they also must not render a blank page. */
export function isUnreachable(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 0 || error.status >= 500;
  }
  return error instanceof TypeError || error instanceof DOMException;
}

/** A single human-readable line for a banner / form-level error. Prefer
 * pinning field errors via `applyFieldErrors` in forms; this is the
 * fallback that must still speak the API's words. */
export function messageFrom(error: unknown): string {
  if (isUnreachable(error)) {
    if (error instanceof ApiError && typeof error.body === "string") return error.body;
    return "Can't reach the API. Is the backend running?";
  }
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return detailMessage(error.body) ?? "You don't have permission to do that.";
    }
    if (error.status === 404) return "Not found.";
    if (error.status === 401) {
      return detailMessage(error.body) ?? "Please sign in again.";
    }
    if (error.status === 400) {
      return (
        detailMessage(error.body) ??
        fieldMessagesSummary(error) ??
        "Something went wrong. Please try again."
      );
    }
    return detailMessage(error.body) ?? "Something went wrong. Please try again.";
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
