import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getFlag, setFlag } from "./profileSetup";

describe("storage seam", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getFlag defaults to false when unset", () => {
    expect(getFlag("share", "acme")).toBe(false);
    expect(getFlag("dismiss", "acme")).toBe(false);
  });

  it("setFlag persists and getFlag reads it back, scoped per slug + kind", () => {
    setFlag("share", "acme");
    expect(getFlag("share", "acme")).toBe(true);
    expect(getFlag("dismiss", "acme")).toBe(false); // different kind
    expect(getFlag("share", "other")).toBe(false); // different slug
  });

  it("getFlag returns false (never throws) when localStorage access throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    expect(getFlag("share", "acme")).toBe(false);
  });

  it("setFlag is a silent no-op when localStorage access throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    expect(() => setFlag("share", "acme")).not.toThrow();
  });
});
