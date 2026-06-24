import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Megaphone, MessageSquarePlus, Pin, Search, X } from "lucide-react";
import { PostCard } from "@/components/PostCard";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { SubmitFeedbackDialog } from "@/components/SubmitFeedbackDialog";
import { AnnouncementComposer } from "@/components/AnnouncementComposer";
import { PinnedStrip } from "@/components/feed/PinnedStrip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { useWorkspace } from "@/context/WorkspaceContext";
import { ApiError, apiFetch } from "@/lib/api";
import { setReturnTo } from "@/lib/returnTo";
import type { PostDTO, PostSort } from "@/lib/postTypes";

function FeedSkeleton() {
  return (
    <ul className="divide-y divide-border" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="flex gap-4 py-5">
          <div className="h-12 w-10 shrink-0 animate-pulse rounded bg-muted" />
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
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [pinnedRefreshKey, setPinnedRefreshKey] = useState(0);
  const [pinnedCount, setPinnedCount] = useState(0);
  const [pendingLocal, setPendingLocal] = useState<PostDTO[]>([]);
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(() => new Set());
  const [categoryFilter, setCategoryFilter] = useState<PostDTO["category"] | "all">("all");

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

  // Any signed-in user who can read the board may participate (submit/upvote/comment).
  // Non-members are blocked from reading invite_only boards upstream (requireWorkspace), so a
  // readable board (no access error) + a signed-in user means participation is allowed — whether
  // they're a member of an invite_only board or an outside participant on a public one.
  const canPost = Boolean(slug && user && !error);
  const canManage = Boolean(
    user &&
    activeWorkspace &&
    activeWorkspace.slug === slug &&
    (activeWorkspace.role === "owner" || activeWorkspace.role === "admin")
  );
  // Founder badge: only the actual workspace owner's posts get the badge, not admins.
  const isOwner = Boolean(user && activeWorkspace && activeWorkspace.slug === slug && activeWorkspace.role === "owner");

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

  const onAnnouncementCreated = useCallback((post: PostDTO) => {
    setPendingLocal((prev) => [post, ...prev.filter((p) => p.id !== post.id)]);
    setPinnedRefreshKey((k) => k + 1);
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

  const visibleFeed = categoryFilter === "all" ? mergedFeed : mergedFeed.filter((p) => p.category === categoryFilter);

  if (!slug) {
    return <p className="text-sm text-muted-foreground">Missing workspace slug.</p>;
  }

  return (
    <div className="space-y-6">
      <ProfileHeader slug={slug} canManage={canManage} />

      {/* Pinned row: PINNED label (only when posts are pinned) + Announcement button (owner-only).
          Collapses entirely for non-owners with nothing pinned. */}
      {pinnedCount > 0 || canManage ? (
        <div className="mx-auto w-full max-w-3xl flex items-center justify-between gap-2">
          {pinnedCount > 0 ? (
            <div className="flex items-center gap-2">
              <Pin className="size-3.5 text-brand" aria-hidden />
              <span className="font-mono text-[10px] tracking-[0.22em] text-brand uppercase">
                Pinned
              </span>
            </div>
          ) : (
            <span aria-hidden />
          )}
          {canManage ? (
            <Button type="button" variant="brand" size="sm" onClick={() => setAnnouncementOpen(true)}>
              <Megaphone className="size-4" />
              Announcement
            </Button>
          ) : null}
        </div>
      ) : null}

      <SubmitFeedbackDialog
        workspaceSlug={slug}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={onCreated}
      />

      <AnnouncementComposer
        workspaceSlug={slug}
        open={announcementOpen}
        onOpenChange={setAnnouncementOpen}
        onCreated={onAnnouncementCreated}
      />

      <PinnedStrip
        slug={slug}
        canManage={canManage}
        upvotedIds={upvotedIds}
        signedIn={Boolean(user)}
        canUpvote={canPost}
        onUpvoteChange={onUpvoteChange}
        refreshKey={pinnedRefreshKey}
        onPinChange={() => setPinnedRefreshKey((k) => k + 1)}
        onLoaded={setPinnedCount}
      />

      <div className="mx-auto mt-6 w-full max-w-3xl space-y-6">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            All feedback
          </span>
          <div className="h-px flex-1 bg-border" aria-hidden />
          {canPost ? (
            <Button type="button" variant="brand" size="sm" onClick={() => setDialogOpen(true)}>
              <MessageSquarePlus className="size-4" />
              Submit feedback
            </Button>
          ) : !user ? (
            <Button type="button" variant="brand" size="sm" asChild>
              <Link
                to="/"
                onClick={() => setReturnTo(window.location.pathname + window.location.search)}
              >
                Sign in to submit
              </Link>
            </Button>
          ) : null}
        </div>
        <div className="flex flex-col gap-3">
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
            <Segmented
              options={[["trending", "Trending"], ["top", "Top"], ["newest", "Newest"]] as const}
              value={sort}
              onChange={(v) => setSort(v as PostSort)}
              disabled={loading}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {([["all", "All"], ["bug", "Bug"], ["feature_request", "Feature"], ["ui_tweak", "UI"]] as const).map(
              ([val, label]) => (
                <button
                  key={val}
                  type="button"
                  aria-pressed={categoryFilter === val}
                  onClick={() => setCategoryFilter(val as typeof categoryFilter)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-[0.12em] uppercase transition-colors",
                    categoryFilter === val
                      ? "border-brand/40 bg-brand-bright/15 text-brand"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              )
            )}
          </div>
        </div>

        {error ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <FeedSkeleton />
        ) : visibleFeed.length === 0 ? (
          <div className="flex items-start gap-4 border-y border-border py-12">
            <span className="flex size-10 shrink-0 items-center justify-center border border-border text-muted-foreground/60">
              <Search className="size-4" />
            </span>
            <p className="pt-2 text-sm text-muted-foreground">
              {searchQuery
                ? `No posts match "${searchQuery}".`
                : categoryFilter !== "all"
                  ? "No posts in this category."
                  : "No posts yet. Be the first to share feedback."}
            </p>
          </div>
        ) : (
          <motion.ul
            className="divide-y divide-border"
            initial="hidden"
            animate="show"
            variants={staggerContainer(0.05)}
          >
            {visibleFeed.map((post) => (
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
                  canManage={canManage}
                  onPinChange={() => setPinnedRefreshKey((k) => k + 1)}
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
    </div>
  );
}
