import type { NextFunction, Request, Response } from "express";
import {
  ExploreFeedCursorSchema,
  ExploreFeedQuerySchema,
  ExploreWorkspacesQuerySchema,
} from "./explore.schemas";
import { listFollowingFeed, listPublicFeed, listPublicWorkspaces } from "./explore.service";

function parseFeedCursor(raw: string | undefined): { createdAt: Date; id: string } | null | "bad" {
  if (!raw) return null;
  try {
    const json: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const parsed = ExploreFeedCursorSchema.safeParse(json);
    if (!parsed.success) return "bad";
    return { createdAt: new Date(parsed.data.createdAt), id: parsed.data.id };
  } catch {
    return "bad";
  }
}

export async function exploreWorkspacesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = ExploreWorkspacesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });
    }
    const workspaces = await listPublicWorkspaces(
      parsed.data.limit,
      req.user?.id,
      parsed.data.sort
    );
    return res.json({ workspaces });
  } catch (err) {
    next(err);
  }
}

export async function exploreFeedHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = ExploreFeedQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });
    }
    const cursor = parseFeedCursor(parsed.data.cursor);
    if (cursor === "bad") return res.status(400).json({ error: "Invalid cursor" });

    if (parsed.data.tab === "following") {
      if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
      const result = await listFollowingFeed({ userId: req.user.id, limit: parsed.data.limit, cursor });
      return res.json(result);
    }

    const result = await listPublicFeed({ limit: parsed.data.limit, cursor });
    return res.json(result);
  } catch (err) {
    next(err);
  }
}
