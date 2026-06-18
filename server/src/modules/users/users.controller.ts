import type { NextFunction, Request, Response } from "express";
import { AvatarPresignBodySchema, UpdateProfileSchema } from "./users.schemas";
import {
  createPresignedAvatarPut,
  isS3UploadConfigured,
  isValidAvatarUrl,
} from "../uploads/uploads.service";
import { updateUserProfile } from "./users.service";

/** POST /api/users/me/avatar/presign — presigned PUT for the caller's own avatar. */
export async function presignAvatarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    if (!isS3UploadConfigured()) {
      return res
        .status(503)
        .json({ error: "File uploads are not configured (S3_BUCKET and AWS_REGION)" });
    }

    const parsed = AvatarPresignBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const result = await createPresignedAvatarPut({ userId, body: parsed.data });
    if (!result.ok) {
      if (result.reason === "bad_extension_mismatch") {
        return res.status(400).json({
          error: "Filename extension must match content type (jpg, png, gif, or webp)",
        });
      }
      return res.status(502).json({ error: "Could not create upload URL", details: result.message });
    }

    return res.json({
      upload_url: result.uploadUrl,
      image_url: result.imageUrl,
      upload_headers: result.headers,
      expires_in_seconds: 300,
    });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/users/me — update the caller's name and/or avatar URL. */
export async function updateMeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const parsed = UpdateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const { avatarUrl, name } = parsed.data;
    // Defense-in-depth: a non-null avatar URL must point at this user's own avatar prefix.
    if (avatarUrl != null && !isValidAvatarUrl(avatarUrl, userId)) {
      return res.status(400).json({ error: "Invalid avatar URL" });
    }

    const updated = await updateUserProfile(userId, { avatarUrl, name });
    if (!updated) return res.status(404).json({ error: "User not found" });

    return res.json({ user: updated });
  } catch (err) {
    next(err);
  }
}
