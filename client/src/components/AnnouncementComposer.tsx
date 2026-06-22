import { useRef, useState } from "react";
import { ImagePlus, Megaphone, X } from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PostDTO } from "@/lib/postTypes";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type AllowedMime = (typeof ALLOWED_MIME)[number];

function isAllowedMime(t: string): t is AllowedMime {
  return (ALLOWED_MIME as readonly string[]).includes(t);
}

type PresignResponse = {
  upload_url: string;
  image_url: string;
  upload_headers: Record<string, string>;
  expires_in_seconds: number;
};

type Props = {
  workspaceSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (post: PostDTO) => void;
};

export function AnnouncementComposer({ workspaceSlug, open, onOpenChange, onCreated }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [attachedImageUrl, setAttachedImageUrl] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  function clearImageAttachment() {
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setLocalPreviewUrl(null);
    setAttachedImageUrl(null);
    setImageUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function reset() {
    clearImageAttachment();
    setTitle("");
    setDescription("");
    setError(null);
    setSubmitting(false);
    setImageUploading(false);
  }

  async function runPresignedUpload(file: File, objectUrlForPreview: string) {
    const contentType = file.type;
    if (!isAllowedMime(contentType)) {
      URL.revokeObjectURL(objectUrlForPreview);
      setLocalPreviewUrl(null);
      setImageUploadError("Use a JPEG, PNG, GIF, or WebP image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      URL.revokeObjectURL(objectUrlForPreview);
      setLocalPreviewUrl(null);
      setImageUploadError("Image must be 5MB or smaller.");
      return;
    }

    setImageUploadError(null);
    setImageUploading(true);
    try {
      const presignPath = `/api/workspaces/${encodeURIComponent(workspaceSlug)}/uploads/presign`;
      const presign = await apiFetch<PresignResponse>(presignPath, {
        method: "POST",
        body: JSON.stringify({
          filename: file.name,
          content_type: contentType,
        }),
      });

      const putHeaders = new Headers();
      for (const [k, v] of Object.entries(presign.upload_headers)) {
        putHeaders.set(k, v);
      }

      const putRes = await fetch(presign.upload_url, {
        method: "PUT",
        body: file,
        headers: putHeaders,
      });

      if (!putRes.ok) {
        setImageUploadError("Upload to storage failed. Try again.");
        return;
      }

      URL.revokeObjectURL(objectUrlForPreview);
      setLocalPreviewUrl(null);
      setAttachedImageUrl(presign.image_url);
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        setImageUploadError("Image upload isn't configured on this server yet.");
      } else if (err instanceof ApiError && err.status === 400) {
        setImageUploadError("That file isn't accepted. Use jpg, png, gif, or webp.");
      } else if (err instanceof ApiError && err.status === 502) {
        setImageUploadError("Storage refused the upload. Try again later.");
      } else {
        setImageUploadError("Couldn't start upload. Try again.");
      }
    } finally {
      setImageUploading(false);
    }
  }

  function handleFileInputChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    clearImageAttachment();
    const url = URL.createObjectURL(file);
    setLocalPreviewUrl(url);
    void runPresignedUpload(file, url);
  }

  function handleDrop(ev: React.DragEvent) {
    ev.preventDefault();
    const file = ev.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    clearImageAttachment();
    const url = URL.createObjectURL(file);
    setLocalPreviewUrl(url);
    void runPresignedUpload(file, url);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Title is required.");
      return;
    }
    if (imageUploading) {
      setError("Wait for the image to finish uploading.");
      return;
    }
    setSubmitting(true);
    try {
      const path = `/api/workspaces/${encodeURIComponent(workspaceSlug)}/posts/announcements`;
      const body: Record<string, unknown> = {
        title: trimmed,
        description: description.trim() || null,
      };
      if (attachedImageUrl) body.image_url = attachedImageUrl;

      const data = await apiFetch<{ post: PostDTO }>(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      onCreated(data.post);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("You must be signed in to post an announcement.");
      } else if (err instanceof ApiError && err.status === 403) {
        setError("Only workspace admins can post announcements.");
      } else if (err instanceof ApiError && err.status === 400) {
        setError("Couldn't save the announcement. Check the image and try again.");
      } else {
        setError("Something went wrong. Try again.");
      }
      setSubmitting(false);
    }
  }

  const previewSrc = attachedImageUrl ?? localPreviewUrl;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md" showClose>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2 text-xl font-semibold tracking-tight text-amber-600 dark:text-amber-400">
              <Megaphone className="size-5 shrink-0" aria-hidden />
              Post an announcement
            </DialogTitle>
            <DialogDescription>
              Announcements are published immediately and appear at the top of your board.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="announcement-title">Title</Label>
            <Input
              id="announcement-title"
              value={title}
              onChange={(ev) => setTitle(ev.target.value)}
              placeholder="What do you want to share?"
              maxLength={255}
              required
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="announcement-body">Body</Label>
            <Textarea
              id="announcement-body"
              value={description}
              onChange={(ev) => setDescription(ev.target.value)}
              placeholder="Details, context, links…"
              rows={4}
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label>Image (optional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="sr-only"
              id="announcement-image"
              disabled={submitting || imageUploading}
              onChange={handleFileInputChange}
            />
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(ev) => {
                ev.preventDefault();
                ev.dataTransfer.dropEffect = "copy";
              }}
              onDrop={handleDrop}
              className="border-input hover:bg-muted/40 focus-visible:ring-ring/50 flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground transition-colors focus-visible:ring-[3px] outline-none"
              onClick={() => !submitting && !imageUploading && fileInputRef.current?.click()}
            >
              {previewSrc ? (
                <div className="relative w-full">
                  <img
                    src={previewSrc}
                    alt="Attachment preview"
                    className="mx-auto max-h-40 rounded-md object-contain"
                  />
                  {imageUploading ? (
                    <p className="text-muted-foreground mt-2 text-xs">Uploading…</p>
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="absolute right-0 top-0 h-8 w-8 p-0"
                    disabled={submitting || imageUploading}
                    onClick={(e) => {
                      e.stopPropagation();
                      clearImageAttachment();
                    }}
                    aria-label="Remove image"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <ImagePlus className="text-muted-foreground size-8" aria-hidden />
                  <span>Drag and drop an image, or click to choose</span>
                  <span className="text-xs">JPEG, PNG, GIF, or WebP · max 5MB</span>
                </>
              )}
            </div>
            {imageUploadError ? <p className="text-destructive text-xs">{imageUploadError}</p> : null}
          </div>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => {
              reset();
              onOpenChange(false);
            }} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || imageUploading}
              className="bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
            >
              {submitting ? "Publishing…" : imageUploading ? "Uploading image…" : "Publish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
