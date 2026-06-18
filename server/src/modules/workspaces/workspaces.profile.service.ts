import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import { appLinks, appScreenshots } from "../../db/schema";
import { findWorkspaceBySlug, type LinkKind, type Workspace } from "./workspaces.service";

export const SCREENSHOT_LIMIT = 5;

/** True when the workspace has room for another screenshot. */
export function canAddScreenshot(currentCount: number): boolean {
  return currentCount < SCREENSHOT_LIMIT;
}

/**
 * A reorder is valid only when the proposed id list is an exact permutation of the
 * current id set: same length, no duplicates, no foreign ids, no missing ids.
 */
export function reorderIdsMatch(currentIds: string[], proposedIds: string[]): boolean {
  if (currentIds.length !== proposedIds.length) return false;
  const proposedSet = new Set(proposedIds);
  if (proposedSet.size !== proposedIds.length) return false; // duplicates
  for (const id of currentIds) {
    if (!proposedSet.has(id)) return false;
  }
  return true;
}

export type ScreenshotRow = { id: string; url: string; sortOrder: number };
export type LinkRow = { id: string; kind: LinkKind; url: string };
export type WorkspaceProfile = {
  workspace: Workspace;
  screenshots: ScreenshotRow[];
  links: LinkRow[];
};

export async function getWorkspaceProfile(slug: string): Promise<WorkspaceProfile | null> {
  const workspace = await findWorkspaceBySlug(slug);
  if (!workspace) return null;

  const [screenshots, links] = await Promise.all([
    db
      .select({ id: appScreenshots.id, url: appScreenshots.url, sortOrder: appScreenshots.sortOrder })
      .from(appScreenshots)
      .where(eq(appScreenshots.workspaceId, workspace.id))
      .orderBy(asc(appScreenshots.sortOrder), asc(appScreenshots.createdAt)),
    db
      .select({ id: appLinks.id, kind: appLinks.kind, url: appLinks.url })
      .from(appLinks)
      .where(eq(appLinks.workspaceId, workspace.id))
      .orderBy(asc(appLinks.createdAt)),
  ]);

  return {
    workspace,
    screenshots: screenshots.map((s) => ({ id: s.id, url: s.url, sortOrder: s.sortOrder })),
    links: links.map((l) => ({ id: l.id, kind: l.kind as LinkKind, url: l.url })),
  };
}

export async function addScreenshot(input: {
  workspaceId: string;
  url: string;
}): Promise<ScreenshotRow | "limit_reached"> {
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(appScreenshots)
    .where(eq(appScreenshots.workspaceId, input.workspaceId));

  const current = Number(countRow?.count ?? 0);
  if (!canAddScreenshot(current)) return "limit_reached";

  const [row] = await db
    .insert(appScreenshots)
    .values({ workspaceId: input.workspaceId, url: input.url, sortOrder: current })
    .returning({ id: appScreenshots.id, url: appScreenshots.url, sortOrder: appScreenshots.sortOrder });

  if (!row) throw new Error("Failed to insert screenshot");
  return { id: row.id, url: row.url, sortOrder: row.sortOrder };
}

export async function deleteScreenshot(input: {
  workspaceId: string;
  id: string;
}): Promise<"ok" | "not_found"> {
  const [deleted] = await db
    .delete(appScreenshots)
    .where(and(eq(appScreenshots.id, input.id), eq(appScreenshots.workspaceId, input.workspaceId)))
    .returning({ id: appScreenshots.id });
  return deleted ? "ok" : "not_found";
}

export async function reorderScreenshots(input: {
  workspaceId: string;
  ids: string[];
}): Promise<"ok" | "mismatch"> {
  const current = await db
    .select({ id: appScreenshots.id })
    .from(appScreenshots)
    .where(eq(appScreenshots.workspaceId, input.workspaceId));
  const currentIds = current.map((r) => r.id);

  if (!reorderIdsMatch(currentIds, input.ids)) return "mismatch";

  await db.transaction(async (tx) => {
    for (let i = 0; i < input.ids.length; i++) {
      await tx
        .update(appScreenshots)
        .set({ sortOrder: i })
        .where(
          and(eq(appScreenshots.id, input.ids[i]!), eq(appScreenshots.workspaceId, input.workspaceId))
        );
    }
  });

  return "ok";
}

export async function addLink(input: {
  workspaceId: string;
  kind: LinkKind;
  url: string;
}): Promise<LinkRow> {
  const [row] = await db
    .insert(appLinks)
    .values({ workspaceId: input.workspaceId, kind: input.kind, url: input.url })
    .returning({ id: appLinks.id, kind: appLinks.kind, url: appLinks.url });
  if (!row) throw new Error("Failed to insert link");
  return { id: row.id, kind: row.kind as LinkKind, url: row.url };
}

export async function deleteLink(input: {
  workspaceId: string;
  id: string;
}): Promise<"ok" | "not_found"> {
  const [deleted] = await db
    .delete(appLinks)
    .where(and(eq(appLinks.id, input.id), eq(appLinks.workspaceId, input.workspaceId)))
    .returning({ id: appLinks.id });
  return deleted ? "ok" : "not_found";
}
