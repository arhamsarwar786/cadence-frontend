import { describe, expect, it } from "vitest";
import { orgLocalToUtcIso, utcIsoToOrgLocal } from "@/shared/lib/datetime";

const VAN = "America/Vancouver";

describe("orgLocalToUtcIso", () => {
  it("converts winter (PST, UTC-8) wall-clock to UTC", () => {
    expect(orgLocalToUtcIso("2026-01-15T09:00", VAN)).toBe("2026-01-15T17:00:00.000Z");
  });
  it("converts summer (PDT, UTC-7) wall-clock to UTC", () => {
    expect(orgLocalToUtcIso("2026-07-15T09:00", VAN)).toBe("2026-07-15T16:00:00.000Z");
  });
  it("handles zones ahead of UTC and day rollover", () => {
    expect(orgLocalToUtcIso("2026-07-15T01:30", "Europe/London")).toBe("2026-07-15T00:30:00.000Z");
  });
  it("returns empty for blank input", () => {
    expect(orgLocalToUtcIso("", VAN)).toBe("");
  });
});

describe("utcIsoToOrgLocal", () => {
  it("round-trips through the org zone", () => {
    const iso = orgLocalToUtcIso("2026-03-10T14:45", VAN);
    expect(utcIsoToOrgLocal(iso, VAN)).toBe("2026-03-10T14:45");
  });
  it("renders midnight as 00:00, not 24:00", () => {
    expect(utcIsoToOrgLocal("2026-01-15T08:00:00Z", VAN)).toBe("2026-01-15T00:00");
  });
  it("returns empty for null", () => {
    expect(utcIsoToOrgLocal(null, VAN)).toBe("");
  });
});
