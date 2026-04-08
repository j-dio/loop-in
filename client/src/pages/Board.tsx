import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PostCard } from "@/components/PostCard";
import { SubmitFeedbackDialog } from "@/components/SubmitFeedbackDialog";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/context/WorkspaceContext";
import { ApiError, apiFetch } from "@/lib/api";
import type { PostDTO, PostSort } from "@/lib/postTypes";

export function Board() {
  const { slug } = useParams();
  const { workspaces, setActiveWorkspace, activeWorkspace, user } = useWorkspace();

  const [sort, setSort] = useState<PostSort>("newest");
  const [posts, setPosts] = useState<PostDTO[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingLocal, setPendingLocal] = useState<PostDTO[]>([]);

  useEffect(() => {
    if (!slug) return;
    const match = workspaces.find((w) => w.slug === slug);
    if (match && match.id !== activeWorkspace?.id) {
      setActiveWorkspace(match);
    }
  }, [slug, workspaces, setActiveWorkspace, activeWorkspace?.id]);

  const canPost = Boolean(slug && user && workspaces.some((w) => w.slug === slug));

  const fetchPage = useCallback(
    async (opts: { sort: PostSort; cursor?: string | undefined; append: boolean }) => {
      if (!slug) return;
      const q = new URLSearchParams({ sort: opts.sort });
      if (opts.cursor) q.set("cursor", opts.cursor);
      const path = `/api/workspaces/${encodeURIComponent(slug)}/posts?${q.toString()}`;
      const data = await apiFetch<{ posts: PostDTO[]; nextCursor: string | null }>(path);
      if (opts.append) {
        setPosts((prev) => [...prev, ...data.posts]);
      } else {
        setPosts(data.posts);
      }
      setNextCursor(data.nextCursor);
    },
    [slug]
  );

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        await fetchPage({ sort, append: false });
        if (!cancelled) setLoading(false);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          setError("Sign in to view this workspace.");
        } else if (e instanceof ApiError && e.status === 403) {
          setError("You do not have access to this workspace.");
        } else if (e instanceof ApiError && e.status === 404) {
          setError("Workspace not found.");
        } else {
          setError("Could not load posts.");
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, sort, fetchPage]);

  const onLoadMore = async () => {
    if (!slug || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      await fetchPage({ sort, cursor: nextCursor, append: true });
    } catch {
      setError("Could not load more posts.");
    } finally {
      setLoadingMore(false);
    }
  };

  const onCreated = useCallback((post: PostDTO) => {
    setPendingLocal((prev) => [post, ...prev.filter((p) => p.id !== post.id)]);
  }, []);

  const mergedFeed = useMemo(() => {
    const ids = new Set(posts.map((p) => p.id));
    const extras = pendingLocal.filter((p) => !ids.has(p.id));
    return [...extras, ...posts];
  }, [posts, pendingLocal]);

  if (!slug) {
    return <p className="text-sm text-muted-foreground">Missing workspace slug.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Board</h1>
          <p className="text-muted-foreground text-sm">
            <span className="font-mono text-foreground">{slug}</span>
            {activeWorkspace && activeWorkspace.slug === slug ? (
              <span className="text-foreground"> · {activeWorkspace.name}</span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border p-0.5">
            {(
              [
                ["trending", "Trending"],
                ["top", "Top"],
                ["newest", "Newest"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant={sort === value ? "default" : "ghost"}
                size="sm"
                className="h-7 rounded-md px-2.5"
                onClick={() => setSort(value)}
                disabled={loading}
              >
                {label}
              </Button>
            ))}
          </div>
          {canPost ? (
            <Button type="button" onClick={() => setDialogOpen(true)}>
              Submit feedback
            </Button>
          ) : user ? (
            <Button type="button" variant="outline" disabled title="Only workspace members can post">
              Submit feedback
            </Button>
          ) : (
            <Button type="button" variant="outline" asChild>
              <Link to="/">Sign in to submit</Link>
            </Button>
          )}
        </div>
      </div>

      <SubmitFeedbackDialog
        workspaceSlug={slug}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={onCreated}
      />

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading posts…</p>
      ) : mergedFeed.length === 0 ? (
        <p className="text-muted-foreground text-sm">No posts yet. Be the first to share feedback.</p>
      ) : (
        <ul className="space-y-3">
          {mergedFeed.map((post) => (
            <li key={post.id}>
              <PostCard
                post={post}
                workspaceSlug={slug}
                pendingHighlight={post.moderationStatus === "pending"}
              />
            </li>
          ))}
        </ul>
      )}

      {nextCursor && !loading ? (
        <Button type="button" variant="secondary" onClick={onLoadMore} disabled={loadingMore}>
          {loadingMore ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}
