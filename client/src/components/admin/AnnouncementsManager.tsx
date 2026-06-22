import { useEffect, useState } from "react";
import { Megaphone, Pin, PinOff, Trash2 } from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnnouncementComposer } from "@/components/AnnouncementComposer";
import { Section } from "@/components/admin/Section";
import type { PostDTO } from "@/lib/postTypes";

type Props = {
  slug: string;
};

export function AnnouncementsManager({ slug }: Props) {
  const [announcements, setAnnouncements] = useState<PostDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetch<{ posts: PostDTO[] }>(
      `/api/workspaces/${encodeURIComponent(slug)}/posts/announcements`
    )
      .then((data) => {
        if (!cancelled) setAnnouncements(data.posts);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load announcements.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  function handleCreated(post: PostDTO) {
    setAnnouncements((prev) => [post, ...prev]);
  }

  async function handlePin(post: PostDTO) {
    const next = !post.pinnedAt;
    setPinningId(post.id);
    setActionError(null);
    try {
      await apiFetch(
        `/api/workspaces/${encodeURIComponent(slug)}/posts/${encodeURIComponent(post.id)}/pin`,
        { method: "PATCH", body: JSON.stringify({ pinned: next }) }
      );
      setAnnouncements((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? { ...p, pinnedAt: next ? new Date().toISOString() : null }
            : p
        )
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setActionError("Pin cap reached. Unpin another post first.");
      } else {
        setActionError("Could not update pin.");
      }
    } finally {
      setPinningId(null);
    }
  }

  async function handleDelete(post: PostDTO) {
    setDeletingId(post.id);
    setActionError(null);
    try {
      await apiFetch(
        `/api/workspaces/${encodeURIComponent(slug)}/posts/${encodeURIComponent(post.id)}`,
        { method: "DELETE" }
      );
      setAnnouncements((prev) => prev.filter((p) => p.id !== post.id));
    } catch {
      setActionError("Could not delete announcement.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <AnnouncementComposer
        workspaceSlug={slug}
        open={composerOpen}
        onOpenChange={setComposerOpen}
        onCreated={handleCreated}
      />

      <div className="max-w-2xl space-y-6">
        <Section title="Announcements">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Announcements are published immediately and appear at the top of your board.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => setComposerOpen(true)}
            >
              <Megaphone className="size-4 mr-1.5" aria-hidden />
              New announcement
            </Button>
          </div>

          {actionError ? (
            <p className="text-destructive text-sm" role="alert">
              {actionError}
            </p>
          ) : null}

          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : announcements.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No announcements yet. Post one to notify your users.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {announcements.map((post) => (
                <li
                  key={post.id}
                  className="flex items-start gap-3 px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm truncate">{post.title}</span>
                      {post.pinnedAt ? (
                        <Badge tone="brand">Pinned</Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(post.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      disabled={pinningId === post.id || deletingId === post.id}
                      onClick={() => void handlePin(post)}
                      aria-label={post.pinnedAt ? "Unpin announcement" : "Pin announcement"}
                      title={post.pinnedAt ? "Unpin" : "Pin"}
                    >
                      {post.pinnedAt ? (
                        <PinOff className="size-4" aria-hidden />
                      ) : (
                        <Pin className="size-4" aria-hidden />
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      disabled={deletingId === post.id || pinningId === post.id}
                      onClick={() => void handleDelete(post)}
                      aria-label="Delete announcement"
                      title="Delete"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
