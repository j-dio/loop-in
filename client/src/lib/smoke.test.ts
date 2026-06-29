import { describe, it, expect } from "vitest";

describe("test infrastructure", () => {
  it("runs and has localStorage from jsdom", () => {
    expect(1 + 1).toBe(2);
    expect(typeof localStorage).toBe("object");
  });
});
