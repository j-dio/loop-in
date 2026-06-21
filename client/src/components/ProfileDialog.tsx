import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ImagePlus, LogOut, Trash2 } from "lucide-react";
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
import { UserAvatar } from "@/components/UserAvatar";
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
  expires_in_seconds: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProfileDialog({ open, onOpenChange }: Props) {
  const { user, refreshSession } = useWorkspace();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [signingOut, setSigningOut] = useState(false);

  const [name, setName] = useState("");
  // Pending avatar URL (null = unchanged; "" = cleared back to default).
  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync local form from the live user each time the dialog opens.
  useEffect(() => {
    if (open && user) {
      setName(user.name ?? "");
      setPendingAvatar(null);
      setRemoved(false);
      setUploadError(null);
      setError(null);
    }
  }, [open, user]);

  if (!user) return null;

  const shownAvatar = removed ? null : (pendingAvatar ?? user.avatarUrl);

  async function runUpload(file: File) {
    if (!isAllowedMime(file.type)) {
      setUploadError("Use a JPEG, PNG, GIF, or WebP image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setUploadError("Image must be 5MB or smaller.");
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const presign = await apiFetch<PresignResponse>("/api/users/me/avatar/presign", {
        method: "POST",
        body: JSON.stringify({ filename: file.name, content_type: file.type }),
      });

      const putHeaders = new Headers();
      for (const [k, v] of Object.entries(presign.upload_headers)) putHeaders.set(k, v);

      const putRes = await fetch(presign.upload_url, { method: "PUT", body: file, headers: putHeaders });
      if (!putRes.ok) {
        setUploadError("Upload to storage failed. Try again.");
        return;
      }

      setPendingAvatar(presign.image_url);
      setRemoved(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        setUploadError("Avatar upload isn’t configured on this server yet.");
      } else if (err instanceof ApiError && err.status === 400) {
        setUploadError("That file isn’t accepted. Use jpg, png, gif, or webp.");
      } else {
        setUploadError("Couldn’t upload the image. Try again.");
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleFileChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (file) void runUpload(file);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (uploading) return;
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name can’t be empty.");
      return;
    }

    const body: Record<string, unknown> = {};
    if (trimmedName !== (user!.name ?? "")) body.name = trimmedName;
    if (removed) body.avatarUrl = null;
    else if (pendingAvatar) body.avatarUrl = pendingAvatar;

    if (Object.keys(body).length === 0) {
      onOpenChange(false);
      return;
    }

    setSaving(true);
    try {
      await apiFetch("/api/users/me", { method: "PATCH", body: JSON.stringify(body) });
      await refreshSession();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setError("Couldn’t save those changes. Check your input and try again.");
      } else {
        setError("Something went wrong. Try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      /* proceed with local cleanup anyway */
    }
    await refreshSession();
    onOpenChange(false);
    navigate("/");
  }

  const busy = saving || uploading || signingOut;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showClose>
        <form onSubmit={handleSave} className="space-y-5">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-semibold tracking-tight">
              Your profile
            </DialogTitle>
            <DialogDescription>
              Your name and picture appear next to feedback you post across every workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-4">
            <UserAvatar
              name={name || user.name}
              avatarUrl={shownAvatar}
              seed={user.id}
              sizeClassName="size-16"
            />
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="sr-only"
                id="avatar-file"
                disabled={busy}
                onChange={handleFileChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="size-4" />
                {uploading ? "Uploading…" : "Upload picture"}
              </Button>
              {shownAvatar ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setRemoved(true);
                    setPendingAvatar(null);
                  }}
                >
                  <Trash2 className="size-4" />
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
          {uploadError ? <p className="text-destructive text-xs">{uploadError}</p> : null}
          <p className="text-muted-foreground text-xs">JPEG, PNG, GIF, or WebP · max 5MB</p>

          <div className="space-y-2">
            <Label htmlFor="profile-name">Display name</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              placeholder="Your name"
              maxLength={255}
              disabled={saving}
            />
          </div>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => void handleSignOut()}
              disabled={busy}
              className="text-muted-foreground hover:text-destructive"
            >
              <LogOut className="size-4" />
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" variant="brand" disabled={busy}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
