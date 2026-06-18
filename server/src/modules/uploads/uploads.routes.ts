import { Router } from "express";
import { authenticate, optionalAuth } from "../../middleware/authenticate";
import { requireParticipant, requireWorkspace } from "../../middleware/workspace";
import { presignUploadHandler } from "./uploads.controller";

const uploadsRouter = Router({ mergeParams: true });

uploadsRouter.post("/presign", authenticate, requireParticipant, presignUploadHandler);

/** Mounted at /api/workspaces/:slug/uploads */
export function createUploadsRouterStack() {
  const r = Router({ mergeParams: true });
  r.use(optionalAuth);
  r.use(requireWorkspace);
  r.use(uploadsRouter);
  return r;
}
