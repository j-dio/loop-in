import { describe, expect, it } from "vitest";
import { CreateWorkspaceBodySchema, InviteMemberBodySchema } from "./workspaces.schemas";

describe("CreateWorkspaceBodySchema", () => {
  it("rejects a create body missing the required core fields", () => {
    const r = CreateWorkspaceBodySchema.safeParse({ name: "X", slug: "x-app" });
    expect(r.success).toBe(false); // tagline/platform/category required
  });

  it("rejects a reserved slug", () => {
    const r = CreateWorkspaceBodySchema.safeParse({
      name: "Home",
      slug: "home",
      tagline: "t",
      platform: "web",
      category: "Productivity",
    });
    expect(r.success).toBe(false);
  });

  it("accepts a full valid body", () => {
    const r = CreateWorkspaceBodySchema.safeParse({
      name: "Orbit Notes",
      slug: "orbit-notes",
      tagline: "Calm notes",
      platform: "web",
      category: "Productivity",
    });
    expect(r.success).toBe(true);
  });
});

describe("InviteMemberBodySchema", () => {
  it("defaults role to admin (invites mint collaborators)", () => {
    const r = InviteMemberBodySchema.safeParse({ email: "a@b.com" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.role).toBe("admin");
  });

  it("accepts an explicit member role (private-board guest)", () => {
    const r = InviteMemberBodySchema.safeParse({ email: "a@b.com", role: "member" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.role).toBe("member");
  });

  it("rejects owner — owner cannot be granted via invite", () => {
    const r = InviteMemberBodySchema.safeParse({ email: "a@b.com", role: "owner" });
    expect(r.success).toBe(false);
  });
});
