import { Router } from "express";
import { authenticate, optionalAuth } from "../../middleware/authenticate";
import { createUsersRateLimiter } from "../../middleware/rateLimit";
import { presignAvatarHandler, updateMeHandler } from "./users.controller";

/** Mounted at /api/users */
export const usersRouter = Router();

// Decode JWT early so the rate limiter keys by user_id; routes still enforce `authenticate`.
usersRouter.use(optionalAuth);
usersRouter.use(createUsersRateLimiter());

usersRouter.post("/me/avatar/presign", authenticate, presignAvatarHandler);
usersRouter.patch("/me", authenticate, updateMeHandler);
