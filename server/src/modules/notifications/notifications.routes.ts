import { Router } from "express";
import { authenticate, optionalAuth } from "../../middleware/authenticate";
import { createNotificationsRateLimiter } from "../../middleware/rateLimit";
import {
  listNotificationsHandler,
  markAllReadHandler,
  markReadHandler,
  unreadCountHandler,
} from "./notifications.controller";

/** Mounted at /api/notifications — all routes require authentication; not workspace-scoped. */
export const notificationsRouter = Router();

// Decode JWT early so the rate limiter keys by user_id; `authenticate` enforces the hard gate.
notificationsRouter.use(optionalAuth);
notificationsRouter.use(createNotificationsRateLimiter());

notificationsRouter.get("/", authenticate, listNotificationsHandler);
notificationsRouter.get("/unread-count", authenticate, unreadCountHandler);
notificationsRouter.post("/read-all", authenticate, markAllReadHandler);
notificationsRouter.post("/:id/read", authenticate, markReadHandler);
