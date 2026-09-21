import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import {
  applyFieldErrors,
  fieldErrorsFrom,
  isUnauthorized,
  messageFrom,
} from "@/shared/lib/errors";

describe("messageFrom", () => {
  it("does not treat 401 as a generic failure", () => {
    expect(isUnauthorized(new ApiError(401, { detail: "no" }))).toBe(true);
    expect(messageFrom(new ApiError(401, {}))).toBe("Please sign in again.");
    expect(messageFrom(new ApiError(401, { detail: "Invalid credentials." }))).toBe(
      "Invalid credentials.",
    );
  });

  it("maps 403 to a permission line", () => {
    expect(messageFrom(new ApiError(403, { detail: "missing permission: clients.create" }))).toBe(
      "missing permission: clients.create",
    );
  });

  it("joins Django ValidationError detail arrays from 400s", () => {
    expect(
      messageFrom(
        new ApiError(400, { detail: ["no active pay cycle — create and activate one first"] }),
      ),
    ).toBe("no active pay cycle — create and activate one first");
  });

  it("surfaces DRF non_field_errors on 400s", () => {
    expect(
      messageFrom(
        new ApiError(400, { non_field_errors: ["payday cannot precede the period end"] }),
      ),
    ).toBe("payday cannot precede the period end");
  });

  it("falls back to field messages when detail is absent", () => {
    expect(messageFrom(new ApiError(400, { payday: ["This field is required."] }))).toBe(
      "payday: This field is required.",
    );
  });

  it("flattens nested serializer errors", () => {
    expect(
      messageFrom(
        new ApiError(400, {
          lines: [{ amount: ["Enter a valid number."] }],
        }),
      ),
    ).toContain("amount");
  });
});

describe("fieldErrorsFrom", () => {
  it("extracts 400 field errors without guessing other statuses", () => {
    expect(fieldErrorsFrom(new ApiError(400, { name: ["Required."] }))).toEqual({
      name: ["Required."],
    });
    expect(fieldErrorsFrom(new ApiError(403, { name: ["no"] }))).toEqual({});
  });

  it("excludes detail and non_field_errors meta keys", () => {
    expect(
      fieldErrorsFrom(
        new ApiError(400, {
          detail: ["cross-field"],
          non_field_errors: ["also cross"],
          payday: ["bad"],
        }),
      ),
    ).toEqual({ payday: ["bad"] });
  });

  it("accepts string field errors", () => {
    expect(fieldErrorsFrom(new ApiError(400, { subject: "an email template carries a subject" }))).toEqual({
      subject: ["an email template carries a subject"],
    });
  });
});

describe("applyFieldErrors", () => {
  it("pins known fields and returns null when fully handled", () => {
    const setError = vi.fn();
    const residual = applyFieldErrors(setError, new ApiError(400, { payday: ["Required."] }), [
      "payday",
      "period_end",
    ]);
    expect(residual).toBeNull();
    expect(setError).toHaveBeenCalledWith("payday", { message: "Required." });
  });

  it("returns non_field_errors even when some fields matched", () => {
    const setError = vi.fn();
    const residual = applyFieldErrors(
      setError,
      new ApiError(400, {
        payday: ["Required."],
        non_field_errors: ["payday cannot precede the period end"],
      }),
      ["payday"],
    );
    expect(setError).toHaveBeenCalledWith("payday", { message: "Required." });
    expect(residual).toBe("payday cannot precede the period end");
  });

  it("returns unmatched field keys as a form message", () => {
    const setError = vi.fn();
    const residual = applyFieldErrors(
      setError,
      new ApiError(400, { referred_by_employee: ["Unknown worker."] }),
      ["first_name"],
    );
    expect(setError).not.toHaveBeenCalled();
    expect(residual).toBe("referred_by_employee: Unknown worker.");
  });
});
