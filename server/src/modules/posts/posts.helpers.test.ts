import { describe, expect, it } from "vitest";
import { isAdminOrOwner, viewerCanSeePost } from "./posts.helpers";

const AUTHOR = "author-id";
const OTHER = "other-id";

function post(over: Partial<{ moderationStatus: string; authorId: string; deletedAt: Date | null }> = {}) {
  return {
    moderationStatus: "approved",
    authorId: AUTHOR,
    deletedAt: null,
    ...over,
  };
}

describe("isAdminOrOwner", () => {
  it("is true for admin and owner only", () => {
    expect(isAdminOrOwner("admin")).toBe(true);
    expect(isAdminOrOwner("owner")).toBe(true);
    expect(isAdminOrOwner("member")).toBe(false);
    expect(isAdminOrOwner(undefined)).toBe(false);
  });
});

describe("viewerCanSeePost", () => {
  it("anyone can see an approved, non-deleted post", () => {
    expect(viewerCanSeePost(post(), { userId: undefined, workspaceRole: undefined })).toBe(true);
  });

  it("nobody can see a soft-deleted post (even staff/author)", () => {
    expect(viewerCanSeePost(post({ deletedAt: new Date() }), { userId: AUTHOR, workspaceRole: "owner" })).toBe(false);
  });

  it("a pending post is hidden from the public", () => {
    expect(
      viewerCanSeePost(post({ moderationStatus: "pending" }), { userId: OTHER, workspaceRole: undefined })
    ).toBe(false);
  });

  it("a pending post is visible to its author", () => {
    expect(
      viewerCanSeePost(post({ moderationStatus: "pending" }), { userId: AUTHOR, workspaceRole: undefined })
    ).toBe(true);
  });

  it("a pending post is visible to staff", () => {
    expect(
      viewerCanSeePost(post({ moderationStatus: "pending" }), { userId: OTHER, workspaceRole: "admin" })
    ).toBe(true);
  });

  it("a rejected/spam post is hidden from the public", () => {
    expect(viewerCanSeePost(post({ moderationStatus: "spam" }), { userId: OTHER, workspaceRole: undefined })).toBe(false);
    expect(viewerCanSeePost(post({ moderationStatus: "rejected" }), { userId: OTHER, workspaceRole: undefined })).toBe(false);
  });
});
