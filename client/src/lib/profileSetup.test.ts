import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { computeSetup, getFlag, setFlag } from "./profileSetup";
import type { WorkspaceProfileDTO } from "./profileTypes";

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

function makeProfile(overrides: Partial<WorkspaceProfileDTO["workspace"]> = {},
  rest: Partial<Pick<WorkspaceProfileDTO, "screenshots" | "links">> = {}
): WorkspaceProfileDTO {
  return {
    workspace: {
      id: "w1",
      name: "Acme",
      slug: "acme",
      logoUrl: null,
      tagline: null,
      description: null,
      platform: null,
      category: null,
      websiteUrl: null,
      visibility: "public",
      createdAt: "2026-06-29T00:00:00.000Z",
      ...overrides,
    },
    screenshots: rest.screenshots ?? [],
    links: rest.links ?? [],
    followerCount: 0,
    isFollowing: false,
  };
}

function doneIds(state: ReturnType<typeof computeSetup>): string[] {
  return state.steps.filter((s) => s.done).map((s) => s.id);
}

describe("computeSetup — step done rules", () => {
  beforeEach(() => localStorage.clear());

  it("tagline done only for non-empty, non-whitespace tagline", () => {
    expect(doneIds(computeSetup(makeProfile({ tagline: null }), "acme", true))).not.toContain("tagline");
    expect(doneIds(computeSetup(makeProfile({ tagline: "" }), "acme", true))).not.toContain("tagline");
    expect(doneIds(computeSetup(makeProfile({ tagline: "   " }), "acme", true))).not.toContain("tagline");
    expect(doneIds(computeSetup(makeProfile({ tagline: "Track feedback" }), "acme", true))).toContain("tagline");
  });

  it("website done via websiteUrl OR at least one link", () => {
    expect(doneIds(computeSetup(makeProfile({ websiteUrl: "https://x.com" }), "acme", true))).toContain("website");
    expect(doneIds(computeSetup(makeProfile({}, { links: [{ id: "l1", kind: "github", url: "https://gh" }] }), "acme", true))).toContain("website");
    expect(doneIds(computeSetup(makeProfile(), "acme", true))).not.toContain("website");
  });

  it("screenshots done when at least one screenshot", () => {
    expect(doneIds(computeSetup(makeProfile({}, { screenshots: [{ id: "s1", url: "u", sortOrder: 0 }] }), "acme", true))).toContain("screenshots");
    expect(doneIds(computeSetup(makeProfile(), "acme", true))).not.toContain("screenshots");
  });

  it("logo done when logoUrl set, and is marked optional", () => {
    const state = computeSetup(makeProfile({ logoUrl: "https://logo" }), "acme", true);
    expect(doneIds(state)).toContain("logo");
    expect(state.steps.find((s) => s.id === "logo")?.optional).toBe(true);
  });

  it("share done when the share flag is set for that slug", () => {
    setFlag("share", "acme");
    expect(doneIds(computeSetup(makeProfile(), "acme", true))).toContain("share");
  });

  it("deep-links: tagline/website/screenshots -> profile section, logo -> settings", () => {
    const steps = computeSetup(makeProfile(), "acme", true).steps;
    const href = (id: string) => steps.find((s) => s.id === id)?.href;
    expect(href("tagline")).toBe("/acme/admin?section=profile");
    expect(href("website")).toBe("/acme/admin?section=profile");
    expect(href("screenshots")).toBe("/acme/admin?section=profile");
    expect(href("logo")).toBe("/acme/admin?section=settings");
    expect(steps.find((s) => s.id === "share")?.action).toBe("share");
  });
});

describe("computeSetup — counts and gating", () => {
  beforeEach(() => localStorage.clear());

  it("requiredTotal is 4 and logo is never counted", () => {
    const state = computeSetup(makeProfile({ logoUrl: "https://logo" }), "acme", true);
    expect(state.requiredTotal).toBe(4);
    expect(state.requiredDone).toBe(0); // logo set but not required
  });

  it("allRequiredDone true only when tagline+website+screenshots+share all done", () => {
    setFlag("share", "acme");
    const complete = computeSetup(
      makeProfile({ tagline: "Hi", websiteUrl: "https://x" }, { screenshots: [{ id: "s1", url: "u", sortOrder: 0 }] }),
      "acme",
      true,
    );
    expect(complete.allRequiredDone).toBe(true);
    expect(complete.requiredDone).toBe(4);
  });

  it("showCard false when not canManage", () => {
    expect(computeSetup(makeProfile(), "acme", false).showCard).toBe(false);
  });

  it("showCard false when dismissed", () => {
    setFlag("dismiss", "acme");
    expect(computeSetup(makeProfile(), "acme", true).showCard).toBe(false);
  });

  it("showCard false when all required done", () => {
    setFlag("share", "acme");
    const complete = computeSetup(
      makeProfile({ tagline: "Hi", websiteUrl: "https://x" }, { screenshots: [{ id: "s1", url: "u", sortOrder: 0 }] }),
      "acme",
      true,
    );
    expect(complete.showCard).toBe(false);
  });

  it("showCard true for a manager with incomplete, non-dismissed board", () => {
    expect(computeSetup(makeProfile(), "acme", true).showCard).toBe(true);
  });
});
