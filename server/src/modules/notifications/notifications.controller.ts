import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { ExploreFeedCursorSchema } from "../explore/explore.schemas";
import {
  getUnreadCount,
  listNotifications,
  markAllRead,
  markOneRead,
} from "./notifications.service";

const NotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  cursor: z.string().optional(),
  filter: z.enum(["all", "unread"]).optional().default("all"),
});

const NotificationIdSchema = z.string().uuid();

function parseCursor(raw: string | undefined): { createdAt: Date; id: string } | null | "bad" {
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

export async function listNotificationsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const parsed = NotificationsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });
    }
    const cursor = parseCursor(parsed.data.cursor);
    if (cursor === "bad") return res.status(400).json({ error: "Invalid cursor" });

    const result = await listNotifications({
      userId,
      limit: parsed.data.limit,
      cursor,
      filter: parsed.data.filter,
    });
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function unreadCountHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const count = await getUnreadCount(userId);
    return res.json({ count });
  } catch (err) {
    next(err);
  }
}

export async function markReadHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const idParsed = NotificationIdSchema.safeParse(req.params.id);
    if (!idParsed.success) return res.status(404).json({ error: "Not found" });

    await markOneRead(idParsed.data, userId);
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function markAllReadHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await markAllRead(userId);
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
