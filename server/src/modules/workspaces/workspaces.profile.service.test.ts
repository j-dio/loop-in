import { describe, expect, it } from "vitest";
import { SCREENSHOT_LIMIT, canAddScreenshot, reorderIdsMatch } from "./workspaces.profile.service";

describe("canAddScreenshot", () => {
  it("allows adding below the limit", () => {
    expect(canAddScreenshot(0)).toBe(true);
    expect(canAddScreenshot(SCREENSHOT_LIMIT - 1)).toBe(true);
  });
  it("blocks adding at or above the limit", () => {
    expect(canAddScreenshot(SCREENSHOT_LIMIT)).toBe(false);
    expect(canAddScreenshot(SCREENSHOT_LIMIT + 1)).toBe(false);
  });
});

describe("reorderIdsMatch", () => {
  it("accepts a permutation of the exact current id set", () => {
    expect(reorderIdsMatch(["a", "b", "c"], ["c", "a", "b"])).toBe(true);
    expect(reorderIdsMatch(["a"], ["a"])).toBe(true);
  });
  it("rejects a foreign id", () => {
    expect(reorderIdsMatch(["a", "b"], ["a", "z"])).toBe(false);
  });
  it("rejects a missing id (wrong length)", () => {
    expect(reorderIdsMatch(["a", "b", "c"], ["a", "b"])).toBe(false);
  });
  it("rejects duplicates in the proposed list", () => {
    expect(reorderIdsMatch(["a", "b"], ["a", "a"])).toBe(false);
  });
  it("rejects an empty proposal against a non-empty set", () => {
    expect(reorderIdsMatch(["a"], [])).toBe(false);
  });
});
