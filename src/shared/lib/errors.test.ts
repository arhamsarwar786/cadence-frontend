import { describe, expect, it } from "vitest";
import { ApiError } from "@/api/client";
import { fieldErrorsFrom, isUnauthorized, messageFrom } from "@/shared/lib/errors";

describe("messageFrom", () => {
  it("does not treat 401 as a generic failure", () => {
    expect(isUnauthorized(new ApiError(401, { detail: "no" }))).toBe(true);
    expect(messageFrom(new ApiError(401, {}))).toBe("Please sign in again.");
  });

  it("maps 403 to a permission line", () => {
    expect(messageFrom(new ApiError(403, { detail: "missing permission: clients.create" }))).toBe(
      "missing permission: clients.create",
    );
  });

  it("extracts 400 field errors without guessing other statuses", () => {
    expect(fieldErrorsFrom(new ApiError(400, { name: ["Required."] }))).toEqual({
      name: ["Required."],
    });
    expect(fieldErrorsFrom(new ApiError(403, { name: ["no"] }))).toEqual({});
  });
});
