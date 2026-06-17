import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { MessageSquarePlus, Search, X } from "lucide-react";
import { PostCard } from "@/components/PostCard";
import { SubmitFeedbackDialog } from "@/components/SubmitFeedbackDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { useWorkspace } from "@/context/WorkspaceContext";
import { ApiError, apiFetch } from "@/lib/api";
import type { PostDTO, PostSort } from "@/lib/postTypes";

function FeedSkeleton() {
  return (
    <ul className="space-y-3" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <li
          key={i}
          className="flex gap-4 rounded-2xl border border-border bg-card p-5"
        >
          <div className="h-14 w-12 shrink-0 animate-pulse rounded-xl bg-muted" />
          <div className="flex-1 space-y-3 py-1">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  );
}

type PostsPage = { posts: PostDTO[]; nextCursor: string | null; upvotedPostIds: string[] };

export function Board() {
  const { slug } = useParams();
  const { workspaces, setActiveWorkspace, activeWorkspace, user } = useWorkspace();

  const [sort, setSort] = useState<PostSort>("newest");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [posts, setPosts] = useState<PostDTO[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingLocal, setPendingLocal] = useState<PostDTO[]>([]);
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(() => new Set());

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(value.trim()), 350);
  }

  function clearSearch() {
    setSearchInput("");
    setSearchQuery("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }

  useEffect(() => {
    if (!slug) return;
    const match = workspaces.find((w) => w.slug === slug);
    if (match && match.id !== activeWorkspace?.id) {
      setActiveWorkspace(match);
    }
  }, [slug, workspaces, setActiveWorkspace, activeWorkspace?.id]);

  const canPost = Boolean(slug && user && workspaces.some((w) => w.slug === slug));
  const isOwner = Boolean(user && activeWorkspace && activeWorkspace.slug === slug && user.id === activeWorkspace.ownerId);

  const fetchPage = useCallback(
    async (opts: { sort: PostSort; cursor?: string | undefined; append: boolean; q?: string }) => {
      if (!slug) return;
      const q = new URLSearchParams({ sort: opts.sort });
      if (opts.cursor) q.set("cursor", opts.cursor);
      if (opts.q) q.set("q", opts.q);
      const path = `/api/workspaces/${encodeURIComponent(slug)}/posts?${q.toString()}`;
      const data = await apiFetch<PostsPage>(path);
      if (opts.append) {
        setPosts((prev) => [...prev, ...data.posts]);
        setUpvotedIds((prev) => {
          const next = new Set(prev);
          for (const id of data.upvotedPostIds) next.add(id);
          return next;
        });
      } else {
        setPosts(data.posts);
        setUpvotedIds(new Set(data.upvotedPostIds));
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
        await fetchPage({ sort, append: false, q: searchQuery || undefined });
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
  }, [slug, sort, searchQuery, fetchPage]);

  const onLoadMore = async () => {
    if (!slug || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      await fetchPage({ sort, cursor: nextCursor, append: true, q: searchQuery || undefined });
    } catch {
      setError("Could not load more posts.");
    } finally {
      setLoadingMore(false);
    }
  };

  const onCreated = useCallback((post: PostDTO) => {
    setPendingLocal((prev) => [post, ...prev.filter((p) => p.id !== post.id)]);
  }, []);

  const onUpvoteChange = useCallback((postId: string, upvoteCount: number, upvoted: boolean) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, upvoteCount } : p)));
    setUpvotedIds((prev) => {
      const next = new Set(prev);
      if (upvoted) next.add(postId);
      else next.delete(postId);
      return next;
    });
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
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl font-medium tracking-tight">Feedback</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeWorkspace && activeWorkspace.slug === slug
                ? activeWorkspace.name
                : null}
              <span className="font-mono"> /{slug}</span>
            </p>
          </div>
          {canPost ? (
            <Button type="button" variant="brand" onClick={() => setDialogOpen(true)}>
              <MessageSquarePlus className="size-4" />
              Submit feedback
            </Button>
          ) : user ? (
            <Button type="button" variant="outline" disabled title="Only workspace members can post">
              <MessageSquarePlus className="size-4" />
              Submit feedback
            </Button>
          ) : (
            <Button type="button" variant="brand" asChild>
              <Link to="/">Sign in to submit</Link>
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search posts…"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="h-9 pl-9 pr-8"
            />
            {searchInput ? (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
          <div className="flex rounded-xl border border-border bg-card p-0.5">
            {(
              [
                ["trending", "Trending"],
                ["top", "Top"],
                ["newest", "Newest"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSort(value)}
                disabled={loading}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60",
                  sort === value
                    ? "bg-brand-bright/15 text-brand"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <SubmitFeedbackDialog
        workspaceSlug={slug}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={onCreated}
      />

      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <FeedSkeleton />
      ) : mergedFeed.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
          <Search className="mx-auto size-7 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">
            {searchQuery
              ? `No posts match "${searchQuery}".`
              : "No posts yet. Be the first to share feedback."}
          </p>
        </div>
      ) : (
        <motion.ul
          className="space-y-3"
          initial="hidden"
          animate="show"
          variants={staggerContainer(0.05)}
        >
          {mergedFeed.map((post) => (
            <motion.li key={post.id} variants={fadeUp}>
              <PostCard
                post={post}
                workspaceSlug={slug}
                pendingHighlight={post.moderationStatus === "pending"}
                upvoted={upvotedIds.has(post.id)}
                signedIn={Boolean(user)}
                canUpvote={canPost}
                onUpvoteChange={onUpvoteChange}
                showFounderBadge={isOwner && post.author.id === user?.id}
              />
            </motion.li>
          ))}
        </motion.ul>
      )}

      {nextCursor && !loading ? (
        <div className="flex justify-center pt-2">
          <Button type="button" variant="outline" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
