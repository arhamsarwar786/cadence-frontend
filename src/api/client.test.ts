import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, isSessionGone, setUnauthorizedHandler } from "@/api/client";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const NOT_AUTH = { detail: "Authentication credentials were not provided." };

describe("isSessionGone", () => {
  it("treats 401 and DRF's anonymous 403 as a lost session", () => {
    expect(isSessionGone(401, {})).toBe(true);
    expect(isSessionGone(403, NOT_AUTH)).toBe(true);
  });

  it("does not treat a permission 403 as a lost session", () => {
    expect(isSessionGone(403, { detail: "missing permission: clients.create" })).toBe(false);
    expect(isSessionGone(403, { detail: "CSRF Failed: CSRF token missing." })).toBe(false);
    expect(isSessionGone(500, NOT_AUTH)).toBe(false);
  });
});

describe("api client unauthorized handling", () => {
  const handler = vi.fn();
  const fetchMock = vi.fn();

  beforeEach(() => {
    handler.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    setUnauthorizedHandler(handler);
  });

  afterEach(() => {
    setUnauthorizedHandler(null);
    vi.unstubAllGlobals();
  });

  it("signals the handler when a write comes back not-authenticated (no CSRF cookie)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(403, NOT_AUTH));
    await expect(api.post("/api/v1/tasks/", { title: "x" })).rejects.toBeInstanceOf(ApiError);
    // The request is still sent without a CSRF cookie, so the server can say what happened.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("signals on a 401 from a read", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, NOT_AUTH));
    await expect(api.get("/api/v1/jobs/")).rejects.toMatchObject({ status: 401 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("never signals for the login, logout or session probe doors", async () => {
    for (const path of ["/api/v1/auth/login/", "/api/v1/auth/logout/", "/api/v1/auth/me/"]) {
      fetchMock.mockResolvedValueOnce(jsonResponse(401, { detail: "Invalid credentials." }));
      await expect(api.post(path, {})).rejects.toBeInstanceOf(ApiError);
    }
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not sign out on a plain permission 403", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(403, { detail: "missing permission: x" }));
    await expect(api.get("/api/v1/jobs/")).rejects.toMatchObject({ status: 403 });
    expect(handler).not.toHaveBeenCalled();
  });

  it("maps a CSRF failure to the refresh message", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(403, { detail: "CSRF Failed: CSRF cookie not set." }));
    await expect(api.post("/api/v1/tasks/", {})).rejects.toThrow(/Refresh the page/);
    expect(handler).not.toHaveBeenCalled();
  });
});
