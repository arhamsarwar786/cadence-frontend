import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "@/api/client";

/**
 * HTTP -> UI mapping (ARCHITECTURE.md §10). A cross-tenant or out-of-scope
 * id is 404, never a 403 that would confirm the row exists — this module
 * never invents a friendlier story for that distinction.
 */

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

/** A 400's field errors, for React Hook Form's setError. Empty for any
 * other status or an unrecognized body shape — never guessed. */
export function fieldErrorsFrom(error: unknown): FieldErrors {
  if (!(error instanceof ApiError) || error.status !== 400) return {};
  const body = error.body;
  if (body === null || typeof body !== "object" || Array.isArray(body)) return {};

  const fieldErrors: FieldErrors = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      fieldErrors[key] = value.map(String);
    } else if (typeof value === "string") {
      fieldErrors[key] = [value];
    }
  }
  return fieldErrors;
}

function detailMessage(body: unknown): string | null {
  if (body !== null && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail?: unknown }).detail;
    return typeof detail === "string" ? detail : null;
  }
  return null;
}

/** Maps a 400's field errors onto a React Hook Form instance — the shared
 * shape of "submit, catch a 400, show it on the right field" every
 * feature's form repeats. Returns whether anything actually matched a
 * known field, so the caller can fall back to a form-level message
 * (a 400 naming a field the form doesn't render, e.g. a cross-field
 * validator) instead of silently swallowing it. */
export function applyFieldErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  error: unknown,
  validKeys: readonly string[],
): boolean {
  let matched = false;
  for (const [field, messages] of Object.entries(fieldErrorsFrom(error))) {
    if (validKeys.includes(field) && messages[0]) {
      setError(field as Path<T>, { message: messages[0] });
      matched = true;
    }
  }
  return matched;
}

/** A single human-readable line for a toast/banner. Prefer a specific
 * field error in a form context — this is the fallback summary. */
export function messageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return detailMessage(error.body) ?? "You don't have permission to do that.";
    }
    if (error.status === 404) return "Not found.";
    if (error.status === 401) return "Please sign in again.";
    return detailMessage(error.body) ?? "Something went wrong. Please try again.";
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
