import { describe, expect, it } from "vitest";
import {
  buildNotificationData,
  eventToNotificationType,
  filterFollowerIds,
  isPubliclyVisible,
} from "./notifications.service";

describe("eventToNotificationType", () => {
  it.each([
    ["planned",    "post_planned"],
    ["in_progress", "post_in_progress"],
    ["shipped",    "post_shipped"],
  ] as const)("maps %s → %s", (status, expected) => {
    expect(eventToNotificationType(status)).toBe(expected);
  });

  it.each(["inbox", "under_review"])(
    "returns null for %s (no notification produced)",
    (status) => {
      expect(eventToNotificationType(status)).toBeNull();
    },
  );

  it("returns null for an unknown status", () => {
    expect(eventToNotificationType("something_else")).toBeNull();
  });
});

describe("filterFollowerIds — dedup for resolveFollowerRecipients", () => {
  it("excludes the post author from the fan-out recipient list", () => {
    expect(filterFollowerIds(["author", "f1", "f2"], ["author"])).toEqual(["f1", "f2"]);
  });

  it("excludes the actor from the fan-out recipient list", () => {
    expect(filterFollowerIds(["f1", "actor", "f2"], ["actor"])).toEqual(["f1", "f2"]);
  });

  it("excludes both author and actor simultaneously", () => {
    expect(
      filterFollowerIds(["f1", "author", "actor", "f2"], ["author", "actor"]),
    ).toEqual(["f1", "f2"]);
  });

  it("handles author === actor (dedup via Set, no double-exclude bug)", () => {
    expect(filterFollowerIds(["self", "f1"], ["self", "self"])).toEqual(["f1"]);
  });

  it("returns all followers when exclude list is empty", () => {
    expect(filterFollowerIds(["f1", "f2", "f3"], [])).toEqual(["f1", "f2", "f3"]);
  });

  it("returns empty array when there are no followers", () => {
    expect(filterFollowerIds([], ["author", "actor"])).toEqual([]);
  });

  it("returns empty when all followers are excluded", () => {
    expect(filterFollowerIds(["author"], ["author"])).toEqual([]);
  });
});

describe("isPubliclyVisible — follower fan-out leak gate", () => {
  it("allows an approved, not-deleted post to reach followers", () => {
    expect(isPubliclyVisible({ moderationStatus: "approved", deletedAt: null })).toBe(true);
  });

  it.each(["pending", "spam", "rejected"])(
    "blocks fan-out when moderation status is %s (hidden post must not leak)",
    (status) => {
      expect(isPubliclyVisible({ moderationStatus: status, deletedAt: null })).toBe(false);
    },
  );

  it("blocks fan-out when the post is soft-deleted, even if approved", () => {
    expect(isPubliclyVisible({ moderationStatus: "approved", deletedAt: new Date() })).toBe(false);
  });
});

describe("buildNotificationData", () => {
  it("assembles a post_approved / app_shipped snapshot (no actor fields)", () => {
    const data = buildNotificationData({
      postTitle: "Dark mode",
      appName: "Orbit Notes",
      appSlug: "orbit-notes",
    });
    expect(data).toEqual({
      postTitle: "Dark mode",
      appName: "Orbit Notes",
      appSlug: "orbit-notes",
    });
  });

  it("includes boardStatus for board-move events", () => {
    const data = buildNotificationData({
      postTitle: "Dark mode",
      appName: "Orbit Notes",
      appSlug: "orbit-notes",
      boardStatus: "planned",
    });
    expect(data.boardStatus).toBe("planned");
    expect(data.commentPreview).toBeUndefined();
    expect(data.actorName).toBeUndefined();
  });

  it("assembles a post_comment snapshot with actor and preview", () => {
    const data = buildNotificationData({
      postTitle: "Dark mode",
      appName: "Orbit Notes",
      appSlug: "orbit-notes",
      actorName: "Maya",
      commentPreview: "Love this idea!",
    });
    expect(data).toEqual({
      postTitle: "Dark mode",
      appName: "Orbit Notes",
      appSlug: "orbit-notes",
      actorName: "Maya",
      commentPreview: "Love this idea!",
    });
  });

  it("truncates commentPreview > 120 chars and appends ellipsis", () => {
    const long = "a".repeat(150);
    const data = buildNotificationData({ commentPreview: long });
    expect(data.commentPreview).toBe("a".repeat(120) + "…");
    expect(data.commentPreview).toHaveLength(121); // 120 + 1 ellipsis char
  });

  it("does not truncate commentPreview at exactly 120 chars", () => {
    const exact = "b".repeat(120);
    const data = buildNotificationData({ commentPreview: exact });
    expect(data.commentPreview).toBe(exact);
  });

  it("does not truncate commentPreview below 120 chars", () => {
    const short = "c".repeat(50);
    const data = buildNotificationData({ commentPreview: short });
    expect(data.commentPreview).toBe(short);
  });

  it("omits undefined fields — no extra keys in output", () => {
    const data = buildNotificationData({ postTitle: "Test" });
    expect(Object.keys(data)).toEqual(["postTitle"]);
  });

  it("returns empty object for empty input", () => {
    expect(buildNotificationData({})).toEqual({});
  });

  it.each(["admin", "member"] as const)(
    "carries role=%s for a workspace_invite snapshot",
    (role) => {
      const data = buildNotificationData({
        appName: "Orbit Notes",
        appSlug: "orbit-notes",
        actorName: "Maya",
        role,
      });
      expect(data).toEqual({
        appName: "Orbit Notes",
        appSlug: "orbit-notes",
        actorName: "Maya",
        role,
      });
    },
  );
});
