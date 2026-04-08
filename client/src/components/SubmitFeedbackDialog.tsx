import { useState } from "react";
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

const CATEGORIES: { value: PostDTO["category"]; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "feature_request", label: "Feature request" },
  { value: "ui_tweak", label: "UI tweak" },
];

type Props = {
  workspaceSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (post: PostDTO) => void;
};

export function SubmitFeedbackDialog({ workspaceSlug, open, onOpenChange, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<PostDTO["category"]>("feature_request");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setDescription("");
    setCategory("feature_request");
    setIsAnonymous(false);
    setError(null);
    setSubmitting(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Title is required.");
      return;
    }
    setSubmitting(true);
    try {
      const path = `/api/workspaces/${encodeURIComponent(workspaceSlug)}/posts`;
      const data = await apiFetch<{ post: PostDTO }>(path, {
        method: "POST",
        body: JSON.stringify({
          title: trimmed,
          description: description.trim() || null,
          category,
          is_anonymous: isAnonymous,
        }),
      });
      onCreated(data.post);
      onOpenChange(false);
      reset();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("You must be signed in to submit feedback.");
      } else if (err instanceof ApiError && err.status === 403) {
        setError("Only workspace members can post here.");
      } else {
        setError("Something went wrong. Try again.");
      }
      setSubmitting(false);
    }
  }

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
            <DialogTitle>Submit feedback</DialogTitle>
            <DialogDescription>
              Your post starts as pending until a moderator approves it for the public board.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="post-title">Title</Label>
            <Input
              id="post-title"
              value={title}
              onChange={(ev) => setTitle(ev.target.value)}
              placeholder="Short summary"
              maxLength={255}
              required
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="post-description">Description</Label>
            <Textarea
              id="post-description"
              value={description}
              onChange={(ev) => setDescription(ev.target.value)}
              placeholder="Details, steps to reproduce, context…"
              rows={4}
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="post-category">Category</Label>
            <select
              id="post-category"
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              value={category}
              onChange={(ev) => setCategory(ev.target.value as PostDTO["category"])}
              disabled={submitting}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(ev) => setIsAnonymous(ev.target.checked)}
              disabled={submitting}
              className="size-4 rounded border"
            />
            Post anonymously
          </label>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
