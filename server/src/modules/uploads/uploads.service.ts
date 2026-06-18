import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const PRESIGN_EXPIRES_SEC = 300;
const UPLOAD_PREFIX = "tmp";
// Avatars + workspace logos live under tmp/* so they ride the existing IAM PutObject
// + bucket public-read policy scoped to tmp/* — no AWS reconfiguration required.
//
// ⚠️ PERSISTENT OBJECTS UNDER tmp/*: despite the "tmp" name, avatars and logos are
// long-lived. Do NOT add an S3 lifecycle rule that expires/deletes tmp/* without
// excluding tmp/avatars/* and tmp/logos/* — otherwise live profile pictures and
// workspace logos will be silently deleted.
const AVATAR_PREFIX = "tmp/avatars";
const LOGO_PREFIX = "tmp/logos";

export type AllowedImageContentType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

const EXT_FOR_MIME: Record<AllowedImageContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

type PresignBody = { filename: string; content_type: AllowedImageContentType };

let s3Client: S3Client | null = null;

export function isS3UploadConfigured(): boolean {
  return Boolean(process.env.S3_BUCKET?.trim() && process.env.AWS_REGION?.trim());
}

function getS3Client(): S3Client {
  if (!s3Client) {
    const region = process.env.AWS_REGION?.trim();
    if (!region) throw new Error("AWS_REGION is required for S3");
    s3Client = new S3Client({ region });
  }
  return s3Client;
}

/** Public base for objects (virtual-hosted or custom CDN origin). No trailing slash. */
export function getBucketPublicBaseUrl(): string {
  const custom = process.env.S3_PUBLIC_BASE_URL?.trim();
  if (custom) return custom.replace(/\/$/, "");
  const bucket = process.env.S3_BUCKET?.trim();
  const region = process.env.AWS_REGION?.trim() ?? "us-east-1";
  if (!bucket) return "";
  return `https://${bucket}.s3.${region}.amazonaws.com`;
}

function extensionFromFilename(filename: string): string | null {
  const m = filename.trim().toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!m) return null;
  const e = m[1];
  if (e === "jpeg") return "jpg";
  if (e === "jpg" || e === "png" || e === "gif" || e === "webp") return e;
  return null;
}

function objectKeyForWorkspace(workspaceId: string, ext: string): string {
  return `${UPLOAD_PREFIX}/${workspaceId}/${randomUUID()}.${ext}`;
}

function objectKeyForAvatar(userId: string, ext: string): string {
  return `${AVATAR_PREFIX}/${userId}/${randomUUID()}.${ext}`;
}

function objectKeyForLogo(workspaceId: string, ext: string): string {
  return `${LOGO_PREFIX}/${workspaceId}/${randomUUID()}.${ext}`;
}

export function publicObjectUrlForKey(objectKey: string): string {
  const base = getBucketPublicBaseUrl();
  const baseUrl = new URL(base);
  const origin = baseUrl.origin;
  const root = baseUrl.pathname === "/" ? "" : baseUrl.pathname.replace(/\/$/, "");
  const encodedKey = objectKey.split("/").map(encodeURIComponent).join("/");
  const path = `${root}/${encodedKey}`.replace(/\/{2,}/g, "/");
  return `${origin}${path}`;
}

/**
 * Shared guard: the URL must point at our bucket (or S3_PUBLIC_BASE_URL origin)
 * under `dirPrefix/` with a UUID image filename. Prevents arbitrary URL injection.
 */
function isValidBucketImageUrl(urlString: string, dirPrefix: string): boolean {
  const base = getBucketPublicBaseUrl();
  if (!base) return false;

  let u: URL;
  try {
    u = new URL(urlString);
  } catch {
    return false;
  }

  const baseUrl = new URL(base);
  if (u.host !== baseUrl.host) return false;

  const root = baseUrl.pathname === "/" ? "" : baseUrl.pathname.replace(/\/$/, "");
  const expectedPrefix = `${root}/${dirPrefix}/`.replace(/\/{2,}/g, "/");
  if (!u.pathname.startsWith(expectedPrefix)) return false;
  if (u.pathname.includes("..")) return false;

  const rest = u.pathname.slice(expectedPrefix.length);
  const uuidFile =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|gif|webp)$/i;
  return uuidFile.test(rest);
}

/** Post images live under tmp/{workspaceId}/. */
export function isValidPostImageUrl(urlString: string, workspaceId: string): boolean {
  return isValidBucketImageUrl(urlString, `${UPLOAD_PREFIX}/${workspaceId}`);
}

/** Avatars live under tmp/avatars/{userId}/. */
export function isValidAvatarUrl(urlString: string, userId: string): boolean {
  return isValidBucketImageUrl(urlString, `${AVATAR_PREFIX}/${userId}`);
}

/** Workspace logos live under tmp/logos/{workspaceId}/. */
export function isValidWorkspaceLogoUrl(urlString: string, workspaceId: string): boolean {
  return isValidBucketImageUrl(urlString, `${LOGO_PREFIX}/${workspaceId}`);
}

export type PresignResult =
  | { ok: true; uploadUrl: string; imageUrl: string; headers: { "Content-Type": string } }
  | { ok: false; reason: "bad_extension_mismatch" | "s3_error"; message?: string };

/** Filename extension must agree with the declared content type. */
function resolveMatchingExt(
  filename: string,
  contentType: AllowedImageContentType
): string | null {
  const extFromName = extensionFromFilename(filename);
  const extFromMime = EXT_FOR_MIME[contentType];
  if (!extFromName || extFromName !== extFromMime) return null;
  return extFromMime;
}

async function presignPutForKey(
  key: string,
  contentType: AllowedImageContentType
): Promise<PresignResult> {
  const bucket = process.env.S3_BUCKET?.trim();
  const region = process.env.AWS_REGION?.trim();
  if (!bucket || !region) {
    return { ok: false, reason: "s3_error", message: "S3 is not configured" };
  }

  const client = getS3Client();
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });

  try {
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: PRESIGN_EXPIRES_SEC });
    return {
      ok: true,
      uploadUrl,
      imageUrl: publicObjectUrlForKey(key),
      headers: { "Content-Type": contentType },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "s3_error", message };
  }
}

export async function createPresignedPut(input: {
  workspaceId: string;
  body: PresignBody;
}): Promise<PresignResult> {
  const ext = resolveMatchingExt(input.body.filename, input.body.content_type);
  if (!ext) return { ok: false, reason: "bad_extension_mismatch" };
  return presignPutForKey(objectKeyForWorkspace(input.workspaceId, ext), input.body.content_type);
}

export async function createPresignedAvatarPut(input: {
  userId: string;
  body: PresignBody;
}): Promise<PresignResult> {
  const ext = resolveMatchingExt(input.body.filename, input.body.content_type);
  if (!ext) return { ok: false, reason: "bad_extension_mismatch" };
  return presignPutForKey(objectKeyForAvatar(input.userId, ext), input.body.content_type);
}

export async function createPresignedLogoPut(input: {
  workspaceId: string;
  body: PresignBody;
}): Promise<PresignResult> {
  const ext = resolveMatchingExt(input.body.filename, input.body.content_type);
  if (!ext) return { ok: false, reason: "bad_extension_mismatch" };
  return presignPutForKey(objectKeyForLogo(input.workspaceId, ext), input.body.content_type);
}
