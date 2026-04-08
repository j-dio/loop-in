import { Router } from "express";
import { authenticate, optionalAuth } from "../../middleware/authenticate";
import { requireWorkspace } from "../../middleware/workspace";
import {
  createCommentHandler,
  deleteCommentHandler,
  listCommentsHandler,
} from "./comments.controller";
import {
  createPostHandler,
  deletePostHandler,
  getPostHandler,
  getUpvoteHandler,
  listPostsHandler,
  patchPostHandler,
  postToggleUpvoteHandler,
} from "./posts.controller";

/**
 * Mounted at /api/workspaces/:slug/posts — parent applies optionalAuth + requireWorkspace.
 */
export const postsScopedRouter = Router({ mergeParams: true });

postsScopedRouter.get("/", listPostsHandler);
postsScopedRouter.get("/:postId/upvote", getUpvoteHandler);
postsScopedRouter.post("/:postId/upvote", authenticate, postToggleUpvoteHandler);
postsScopedRouter.get("/:postId/comments", listCommentsHandler);
postsScopedRouter.post("/:postId/comments", authenticate, createCommentHandler);
postsScopedRouter.delete("/:postId/comments/:commentId", authenticate, deleteCommentHandler);
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
