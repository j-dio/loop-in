import { describe, it, expect } from "vitest";
import { isReservedSlug } from "./reservedSlugs";

describe("isReservedSlug", () => {
  it("blocks static route segments", () => {
    for (const s of ["home", "explore", "welcome", "admin", "api", "auth", "invite", "notifications"]) {
      expect(isReservedSlug(s)).toBe(true);
    }
  });
  it("is case-insensitive and trims", () => {
    expect(isReservedSlug("  Home ")).toBe(true);
  });
  it("allows a normal app slug", () => {
    expect(isReservedSlug("orbit-notes")).toBe(false);
  });
});
