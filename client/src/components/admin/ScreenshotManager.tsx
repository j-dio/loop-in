import { useEffect, useRef, useState } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { ImagePlus, Trash2, GripVertical } from "lucide-react";
import {
  addScreenshot,
  deleteScreenshot,
  getWorkspaceProfile,
  presignScreenshot,
  reorderScreenshots,
} from "@/lib/api";
import { Section } from "@/components/admin/Section";
import { Button } from "@/components/ui/button";
import type { ScreenshotDTO } from "@/lib/profileTypes";

const MAX = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export function ScreenshotManager({ slug }: { slug: string }) {
  const [shots, setShots] = useState<ScreenshotDTO[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const p = await getWorkspaceProfile(slug);
      if (!cancelled) setShots(p.screenshots);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function upload(file: File) {
    if (!ALLOWED.includes(file.type)) {
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
      const presign = await presignScreenshot(slug, { filename: file.name, content_type: file.type });
      const headers = new Headers();
      for (const [k, v] of Object.entries(presign.upload_headers)) headers.set(k, v);
      const put = await fetch(presign.upload_url, { method: "PUT", body: file, headers });
      if (!put.ok) {
        setError("Upload to storage failed. Try again.");
        return;
      }
      const { screenshot } = await addScreenshot(slug, presign.image_url);
      setShots((prev) => [...prev, screenshot]);
    } catch {
      setError("Couldn’t add the screenshot. Try again.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteScreenshot(slug, id);
      setShots((prev) => prev.filter((s) => s.id !== id));
    } catch {
      setError("Couldn’t remove the screenshot.");
    } finally {
      setBusy(false);
    }
  }

  async function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    const prev = shots;
    const next = Array.from(shots);
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    setError(null);
    setShots(next);
    try {
      await reorderScreenshots(slug, next.map((s) => s.id));
    } catch {
      // Revert so the visible order matches the server (which kept the old order).
      setShots(prev);
      setError("Couldn’t save the new order. Please try again.");
    }
  }

  return (
    <Section title="Screenshots">
      <DragDropContext onDragEnd={(r) => void onDragEnd(r)}>
        <Droppable droppableId="screenshots" direction="horizontal">
          {(provided) => (
            <div className="flex flex-wrap gap-3" ref={provided.innerRef} {...provided.droppableProps}>
              {shots.map((s, i) => (
                <Draggable key={s.id} draggableId={s.id} index={i}>
                  {(p) => (
                    <div
                      ref={p.innerRef}
                      {...p.draggableProps}
                      className="group relative h-28 w-40 overflow-hidden rounded-xl border border-border"
                    >
                      <img src={s.url} alt="" className="h-full w-full object-cover" />
                      <span
                        {...p.dragHandleProps}
                        className="absolute left-1 top-1 rounded bg-black/50 p-0.5 text-white"
                        aria-label="Drag to reorder"
                      >
                        <GripVertical className="size-3.5" />
                      </span>
                      <button
                        type="button"
                        onClick={() => void remove(s.id)}
                        disabled={busy}
                        className="absolute right-1 top-1 rounded bg-black/50 p-1 text-white hover:bg-destructive"
                        aria-label="Remove screenshot"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="sr-only"
        disabled={busy || shots.length >= MAX}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || shots.length >= MAX}
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus className="size-4" />
          {busy ? "Working…" : "Add screenshot"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {shots.length}/{MAX} · drag to reorder
        </span>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </Section>
  );
}
