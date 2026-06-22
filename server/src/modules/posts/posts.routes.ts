import { Router } from "express";
import { authenticate, optionalAuth } from "../../middleware/authenticate";
import { requireParticipant, requireRole, requireWorkspace } from "../../middleware/workspace";
import {
  createCommentHandler,
  deleteCommentHandler,
  listCommentsHandler,
} from "./comments.controller";
import {
  createPostUpdateHandler,
  listPostUpdatesHandler,
} from "./postUpdates.controller";
import {
  createAnnouncementHandler,
  createPostHandler,
  deletePostHandler,
  getPostHandler,
  getUpvoteHandler,
  listAdminKanbanHandler,
  listAdminTriageHandler,
  listAnnouncementsHandler,
  listPinnedHandler,
  listPostsHandler,
  moderatePostHandler,
  patchPostBoardStatusHandler,
  patchPostHandler,
  pinPostHandler,
  postToggleUpvoteHandler,
} from "./posts.controller";

const adminOnly = [authenticate, requireRole("owner", "admin")] as const;

/**
 * Mounted at /api/workspaces/:slug/posts — parent applies optionalAuth + requireWorkspace.
 */
export const postsScopedRouter = Router({ mergeParams: true });

postsScopedRouter.get("/", listPostsHandler);
postsScopedRouter.get("/announcements", ...adminOnly, listAnnouncementsHandler);
postsScopedRouter.post("/announcements", ...adminOnly, createAnnouncementHandler);
postsScopedRouter.get("/admin/triage", ...adminOnly, listAdminTriageHandler);
postsScopedRouter.get("/admin/kanban", ...adminOnly, listAdminKanbanHandler);
postsScopedRouter.get("/pinned", listPinnedHandler);
postsScopedRouter.get("/:postId/upvote", getUpvoteHandler);
postsScopedRouter.post("/:postId/upvote", authenticate, requireParticipant, postToggleUpvoteHandler);
postsScopedRouter.get("/:postId/updates", listPostUpdatesHandler);
postsScopedRouter.post("/:postId/updates", ...adminOnly, createPostUpdateHandler);
postsScopedRouter.get("/:postId/comments", listCommentsHandler);
postsScopedRouter.post("/:postId/comments", authenticate, requireParticipant, createCommentHandler);
postsScopedRouter.delete("/:postId/comments/:commentId", authenticate, deleteCommentHandler);
postsScopedRouter.get("/:postId", getPostHandler);
postsScopedRouter.post("/", authenticate, requireParticipant, createPostHandler);
postsScopedRouter.patch("/:postId/moderate", ...adminOnly, moderatePostHandler);
postsScopedRouter.patch("/:postId/status", ...adminOnly, patchPostBoardStatusHandler);
postsScopedRouter.patch("/:postId/pin", ...adminOnly, pinPostHandler);
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
