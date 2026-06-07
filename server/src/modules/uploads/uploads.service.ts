import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const PRESIGN_EXPIRES_SEC = 300;
const UPLOAD_PREFIX = "tmp";

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
 * Ensures the URL points at our bucket (or S3_PUBLIC_BASE_URL origin) under tmp/{workspaceId}/ with a UUID filename.
 * Prevents arbitrary image_url injection on post create.
 */
export function isValidPostImageUrl(urlString: string, workspaceId: string): boolean {
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
  const expectedPrefix = `${root}/${UPLOAD_PREFIX}/${workspaceId}/`.replace(/\/{2,}/g, "/");
  if (!u.pathname.startsWith(expectedPrefix)) return false;
  if (u.pathname.includes("..")) return false;

  const rest = u.pathname.slice(expectedPrefix.length);
  const uuidFile =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|gif|webp)$/i;
  return uuidFile.test(rest);
}

export type PresignResult =
  | { ok: true; uploadUrl: string; imageUrl: string; headers: { "Content-Type": string } }
  | { ok: false; reason: "bad_extension_mismatch" | "s3_error"; message?: string };

export async function createPresignedPut(input: {
  workspaceId: string;
  body: PresignBody;
}): Promise<PresignResult> {
  const extFromName = extensionFromFilename(input.body.filename);
  const extFromMime = EXT_FOR_MIME[input.body.content_type];
  if (!extFromName || extFromName !== extFromMime) {
    return { ok: false, reason: "bad_extension_mismatch" };
  }

  const bucket = process.env.S3_BUCKET?.trim();
  const region = process.env.AWS_REGION?.trim();
  if (!bucket || !region) {
    return { ok: false, reason: "s3_error", message: "S3 is not configured" };
  }

  const key = objectKeyForWorkspace(input.workspaceId, extFromMime);
  const client = getS3Client();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: input.body.content_type,
  });

  try {
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: PRESIGN_EXPIRES_SEC });
    const imageUrl = publicObjectUrlForKey(key);
    return {
      ok: true,
      uploadUrl,
      imageUrl,
      headers: { "Content-Type": input.body.content_type },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "s3_error", message };
  }
}
