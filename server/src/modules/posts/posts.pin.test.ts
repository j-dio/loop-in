import { describe, it, expect } from "vitest";
import { canPin } from "./posts.pin";

describe("canPin", () => {
  it("allows pinning under the cap of 3", () => {
    expect(canPin(0, false)).toBe(true);
    expect(canPin(2, false)).toBe(true);
  });
  it("blocks a 4th pin", () => {
    expect(canPin(3, false)).toBe(false);
  });
  it("always allows toggling an already-pinned post (idempotent / unpin path)", () => {
    expect(canPin(3, true)).toBe(true);
  });
});
