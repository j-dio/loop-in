import { describe, expect, it } from "vitest";
import { CreateWorkspaceBodySchema } from "./workspaces.schemas";

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
