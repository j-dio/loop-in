import { Router } from "express";
import { authenticate, optionalAuth } from "../../middleware/authenticate";
import { requireWorkspace } from "../../middleware/workspace";
import {
  createPostHandler,
  deletePostHandler,
  getPostHandler,
  listPostsHandler,
  patchPostHandler,
} from "./posts.controller";

/**
 * Mounted at /api/workspaces/:slug/posts — parent applies optionalAuth + requireWorkspace.
 */
export const postsScopedRouter = Router({ mergeParams: true });

postsScopedRouter.get("/", listPostsHandler);
postsScopedRouter.get("/:postId", getPostHandler);
postsScopedRouter.post("/", authenticate, createPostHandler);
postsScopedRouter.patch("/:postId", authenticate, patchPostHandler);
postsScopedRouter.delete("/:postId", authenticate, deletePostHandler);

/** Stack: optionalAuth → requireWorkspace → posts routes */
export function createPostsRouterStack() {
  const r = Router({ mergeParams: true });
  r.use(optionalAuth);
  r.use(requireWorkspace);
  r.use(postsScopedRouter);
  return r;
}
