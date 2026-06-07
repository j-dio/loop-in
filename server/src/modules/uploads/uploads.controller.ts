import type { NextFunction, Request, Response } from "express";
import { PresignBodySchema, UploadsParentParamsSchema } from "./uploads.schemas";
import { createPresignedPut, isS3UploadConfigured } from "./uploads.service";

export async function presignUploadHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    if (!isS3UploadConfigured()) {
      return res.status(503).json({ error: "File uploads are not configured (S3_BUCKET and AWS_REGION)" });
    }

    const paramsParsed = UploadsParentParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json({ error: "Invalid params", details: paramsParsed.error.flatten() });
    }

    const bodyParsed = PresignBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({ error: "Invalid request", details: bodyParsed.error.flatten() });
    }

    const result = await createPresignedPut({
      workspaceId: req.workspace.id,
      body: {
        filename: bodyParsed.data.filename,
        content_type: bodyParsed.data.content_type,
      },
    });

    if (!result.ok) {
      if (result.reason === "bad_extension_mismatch") {
        return res.status(400).json({
          error: "Filename extension must match content type (jpg, png, gif, or webp)",
        });
      }
      return res.status(502).json({
        error: "Could not create upload URL",
        details: result.message,
      });
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
