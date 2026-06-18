import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/admin/Section";
import { WorkspaceTile } from "@/components/WorkspaceTile";
import { useWorkspace } from "@/context/WorkspaceContext";

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
};

/** Workspace logo upload/remove. Self-contained: reads + refreshes the active workspace. */
export function WorkspaceLogoSection({ canManage }: { canManage: boolean }) {
  const { activeWorkspace, refreshSession } = useWorkspace();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!activeWorkspace) return null;
  const slug = activeWorkspace.slug;

  async function uploadAndSave(file: File) {
    if (!isAllowedMime(file.type)) {
      setError("Use a JPEG, PNG, GIF, or WebP image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Image must be 5MB or smaller.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const presign = await apiFetch<PresignResponse>(
        `/api/workspaces/${encodeURIComponent(slug)}/logo/presign`,
        { method: "POST", body: JSON.stringify({ filename: file.name, content_type: file.type }) }
      );

      const putHeaders = new Headers();
      for (const [k, v] of Object.entries(presign.upload_headers)) putHeaders.set(k, v);
      const putRes = await fetch(presign.upload_url, { method: "PUT", body: file, headers: putHeaders });
      if (!putRes.ok) {
        setError("Upload to storage failed. Try again.");
        return;
      }

      await apiFetch(`/api/workspaces/${encodeURIComponent(slug)}/logo`, {
        method: "PATCH",
        body: JSON.stringify({ logo_url: presign.image_url }),
      });
      await refreshSession();
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        setError("Logo upload isn’t configured on this server yet.");
      } else if (err instanceof ApiError && err.status === 403) {
        setError("Only admins can change the workspace logo.");
      } else {
        setError("Couldn’t update the logo. Try again.");
      }
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeLogo() {
    setError(null);
    setBusy(true);
    try {
      await apiFetch(`/api/workspaces/${encodeURIComponent(slug)}/logo`, {
        method: "PATCH",
        body: JSON.stringify({ logo_url: null }),
      });
      await refreshSession();
    } catch {
      setError("Couldn’t remove the logo. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Workspace logo">
      <div className="flex items-center gap-4">
        <WorkspaceTile
          name={activeWorkspace.name}
          seed={activeWorkspace.slug}
          logoUrl={activeWorkspace.logoUrl}
          sizeClassName="size-16"
        />
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="sr-only"
              id="ws-logo-file"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadAndSave(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="size-4" />
              {busy ? "Working…" : activeWorkspace.logoUrl ? "Replace logo" : "Upload logo"}
            </Button>
            {activeWorkspace.logoUrl ? (
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void removeLogo()}>
                <Trash2 className="size-4" />
                Remove
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Only admins can change the workspace logo.</p>
        )}
      </div>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
      <p className="text-muted-foreground text-xs">
        Shown on the Explore feed and public directory. Optional — a colored monogram is used otherwise.
        JPEG, PNG, GIF, or WebP · max 5MB.
      </p>
    </Section>
  );
}
