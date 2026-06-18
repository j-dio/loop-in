import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowBigUp, Compass, Megaphone, MessageSquare } from "lucide-react";
import { Logo, LoopMark } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { FollowButton } from "@/components/FollowButton";
import { apiFetch } from "@/lib/api";
import type { FollowingFeedItem } from "@/lib/api";
import { useWorkspace } from "@/context/WorkspaceContext";
import { categoryLabel, categoryTone, boardLabel, boardTone } from "@/lib/postDisplay";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { WorkspaceTile } from "@/components/WorkspaceTile";
import { UserAvatar } from "@/components/UserAvatar";

type ExploreWorkspace = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  createdAt: string;
  postCount: number;
  followerCount: number;
  isFollowing: boolean;
};

type FeedItem = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  category: "bug" | "feature_request" | "ui_tweak";
  boardStatus: "inbox" | "under_review" | "planned" | "in_progress" | "shipped";
  upvoteCount: number;
  createdAt: string;
  author: { id?: string; name: string; avatarUrl: string | null };
  workspace: { name: string; slug: string; logoUrl: string | null };
};

function snippet(text: string | null, max = 160) {
  if (!text) return null;
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export function Explore() {
  const { user } = useWorkspace();
  const [workspaces, setWorkspaces] = useState<ExploreWorkspace[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"discover" | "following">("discover");
  const [following, setFollowing] = useState<FollowingFeedItem[]>([]);
  const [followingCursor, setFollowingCursor] = useState<string | null>(null);
  const [followingLoaded, setFollowingLoaded] = useState(false);

  const loadFeed = useCallback(async (cursor?: string) => {
    const q = new URLSearchParams();
    if (cursor) q.set("cursor", cursor);
    return apiFetch<{ items: FeedItem[]; nextCursor: string | null }>(
      `/api/explore/feed?${q.toString()}`
    );
  }, []);

  const loadFollowing = useCallback(async (cursor?: string) => {
    const q = new URLSearchParams({ tab: "following" });
    if (cursor) q.set("cursor", cursor);
    return apiFetch<{ items: FollowingFeedItem[]; nextCursor: string | null }>(
      `/api/explore/feed?${q.toString()}`
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const [ws, fd] = await Promise.all([
          apiFetch<{ workspaces: ExploreWorkspace[] }>("/api/explore/workspaces"),
          loadFeed(),
        ]);
        if (cancelled) return;
        setWorkspaces(ws.workspaces);
        setFeed(fd.items);
        setNextCursor(fd.nextCursor);
      } catch {
        if (!cancelled) setError("Could not load public boards. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadFeed]);

  useEffect(() => {
    if (tab !== "following" || !user || followingLoaded) return;
    let cancelled = false;
    void (async () => {
      try {
        const fd = await loadFollowing();
        if (cancelled) return;
        setFollowing(fd.items);
        setFollowingCursor(fd.nextCursor);
      } catch {
        /* leave empty; empty state handles it */
      } finally {
        if (!cancelled) setFollowingLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, user, followingLoaded, loadFollowing]);

  const onLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const fd = await loadFeed(nextCursor);
      setFeed((prev) => [...prev, ...fd.items]);
      setNextCursor(fd.nextCursor);
    } catch {
      /* keep what we have */
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-5 sm:px-8">
          <Link to="/" aria-label="Loop In home">
            <Logo />
          </Link>
          <span className="hidden text-border sm:inline" aria-hidden>/</span>
          <span className="hidden font-mono text-xs tracking-wide text-muted-foreground sm:inline">
            explore
          </span>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/">Dashboard</Link>
              </Button>
            ) : (
              <Button variant="brand" size="sm" asChild>
                <Link to="/">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 lg:py-16">
        <motion.div initial="hidden" animate="show" variants={staggerContainer(0.08)}>
          <motion.p
            variants={fadeUp}
            className="flex items-center gap-2 font-mono text-xs tracking-[0.22em] text-brand uppercase"
          >
            <Compass className="size-3.5" /> Public discovery
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="font-display mt-4 text-[clamp(2.25rem,5vw,3.75rem)] leading-[0.98] font-semibold tracking-[-0.03em]"
          >
            See what people are asking for.
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-4 max-w-xl text-muted-foreground">
            Browse open feedback boards from teams building in public. Found something you care
            about? Sign in to upvote it or add your own idea.
          </motion.p>
        </motion.div>

        {error ? (
          <p
            className="mt-10 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {user ? (
          <div className="mt-10">
            <Segmented
              value={tab}
              onChange={(v) => setTab(v as "discover" | "following")}
              options={[["discover", "Discover"], ["following", "Following"]]}
            />
          </div>
        ) : null}

        {loading ? (
          <div className="mt-12 flex flex-col items-center gap-3 py-16">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
              <LoopMark className="size-7" />
            </motion.div>
            <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">Loading…</p>
          </div>
        ) : (
          <>
            {tab === "discover" ? (
              <>
                {/* Public workspaces directory */}
                <section className="mt-12" aria-labelledby="ws-heading">
                  <h2 id="ws-heading" className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
                    Public boards · {workspaces.length}
                  </h2>
                  {workspaces.length === 0 ? (
                    <p className="mt-4 text-sm text-muted-foreground">No public boards yet.</p>
                  ) : (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {workspaces.map((w) => (
                        <div
                          key={w.id}
                          className="group flex flex-col justify-between gap-4 rounded-xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-brand/40"
                        >
                          <Link to={`/${encodeURIComponent(w.slug)}`} className="flex items-center gap-3">
                            <WorkspaceTile
                              name={w.name}
                              seed={w.slug}
                              logoUrl={w.logoUrl}
                              sizeClassName="size-10"
                            />
                            <div className="min-w-0">
                              <h3 className="font-display truncate text-lg font-semibold tracking-tight group-hover:text-brand">
                                {w.name}
                              </h3>
                              <p className="mt-0.5 font-mono text-xs text-muted-foreground">/{w.slug}</p>
                            </div>
                          </Link>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-3">
                              <span className="inline-flex items-center gap-1.5">
                                <MessageSquare className="size-3.5" />
                                {w.postCount} {w.postCount === 1 ? "post" : "posts"}
                              </span>
                              <span className="tabular-nums">
                                {w.followerCount} {w.followerCount === 1 ? "follower" : "followers"}
                              </span>
                            </span>
                            <FollowButton
                              slug={w.slug}
                              initialFollowing={w.isFollowing}
                              initialCount={w.followerCount}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Aggregated feed */}
                <section className="mt-14" aria-labelledby="feed-heading">
                  <h2 id="feed-heading" className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
                    Latest across all boards
                  </h2>
                  {feed.length === 0 ? (
                    <p className="mt-4 text-sm text-muted-foreground">No public feedback yet.</p>
                  ) : (
                    <ul className="mt-4 space-y-3">
                      {feed.map((p) => (
                        <li key={`${p.workspace.slug}-${p.id}`}>
                          <Link
                            to={`/${encodeURIComponent(p.workspace.slug)}/post/${p.id}`}
                            className="group flex gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-brand/40 sm:p-5"
                          >
                            <div className="flex shrink-0 flex-col items-center gap-2">
                              <WorkspaceTile
                                name={p.workspace.name}
                                seed={p.workspace.slug}
                                logoUrl={p.workspace.logoUrl}
                                sizeClassName="size-11"
                              />
                              <div className="flex min-w-11 flex-col items-center gap-0.5 rounded-xl border border-border px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                                <ArrowBigUp className="size-4" strokeWidth={2} aria-hidden />
                                <span className="tabular-nums">{p.upvoteCount}</span>
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-2">
                                <span className="font-display truncate text-sm font-semibold tracking-tight text-foreground group-hover:text-brand">
                                  {p.workspace.name}
                                </span>
                                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                                  /{p.workspace.slug}
                                </span>
                              </div>
                              <div className="mt-1.5 flex flex-wrap items-start justify-between gap-2">
                                <span className="text-base font-semibold tracking-tight text-foreground">
                                  {p.title}
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  <Badge tone={categoryTone(p.category)}>{categoryLabel(p.category)}</Badge>
                                  <Badge tone={boardTone(p.boardStatus)}>{boardLabel(p.boardStatus)}</Badge>
                                </div>
                              </div>
                              {p.imageUrl ? (
                                <div className="mt-3 flex justify-center overflow-hidden rounded-xl border border-border bg-muted/30">
                                  <img
                                    src={p.imageUrl}
                                    alt={p.title}
                                    className="h-auto max-h-[30rem] w-full object-contain"
                                    loading="lazy"
                                    onError={(e) => {
                                      const wrap = e.currentTarget.parentElement;
                                      if (wrap) wrap.style.display = "none";
                                    }}
                                  />
                                </div>
                              ) : null}
                              {snippet(p.description) ? (
                                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                  {snippet(p.description)}
                                </p>
                              ) : null}
                              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <UserAvatar
                                  name={p.author.name}
                                  avatarUrl={p.author.avatarUrl}
                                  seed={p.author.id}
                                  anonymous={!p.author.id}
                                  sizeClassName="size-5"
                                />
                                <span>{p.author.name}</span>
                                <span aria-hidden>·</span>
                                <time dateTime={p.createdAt}>
                                  {new Date(p.createdAt).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </time>
                              </div>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}

                  {nextCursor ? (
                    <div className="mt-6 flex justify-center">
                      <Button variant="outline" onClick={onLoadMore} disabled={loadingMore}>
                        {loadingMore ? "Loading…" : "Load more"}
                      </Button>
                    </div>
                  ) : null}
                </section>
              </>
            ) : (
              <section className="mt-12" aria-labelledby="following-heading">
                <h2 id="following-heading" className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
                  From apps you follow
                </h2>
                {following.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
                    You're not following any apps yet — follow apps from{" "}
                    <button
                      type="button"
                      className="font-medium text-brand hover:underline"
                      onClick={() => setTab("discover")}
                    >
                      Discover
                    </button>{" "}
                    and their activity shows up here.
                  </div>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {following.map((item) =>
                      item.type === "post" ? (
                        <li key={`p-${item.id}`}>
                          <Link
                            to={`/${encodeURIComponent(item.workspace.slug)}/post/${item.id}`}
                            className="group flex gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-brand/40 sm:p-5"
                          >
                            <WorkspaceTile
                              name={item.workspace.name}
                              seed={item.workspace.slug}
                              logoUrl={item.workspace.logoUrl}
                              sizeClassName="size-11"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-2">
                                <span className="font-display truncate text-sm font-semibold tracking-tight group-hover:text-brand">
                                  {item.workspace.name}
                                </span>
                                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                                  /{item.workspace.slug}
                                </span>
                              </div>
                              <p className="mt-1.5 text-base font-semibold tracking-tight text-foreground">
                                {item.title}
                              </p>
                              {snippet(item.description) ? (
                                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                  {snippet(item.description)}
                                </p>
                              ) : null}
                            </div>
                          </Link>
                        </li>
                      ) : (
                        <li key={`u-${item.id}`}>
                          <Link
                            to={`/${encodeURIComponent(item.workspace.slug)}/post/${item.post.id}`}
                            className="group flex gap-4 rounded-xl border border-brand/30 bg-brand-bright/5 p-4 transition-all hover:-translate-y-0.5 hover:border-brand/50 sm:p-5"
                          >
                            <WorkspaceTile
                              name={item.workspace.name}
                              seed={item.workspace.slug}
                              logoUrl={item.workspace.logoUrl}
                              sizeClassName="size-11"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.18em] text-brand uppercase">
                                <Megaphone className="size-3.5" /> Update · {item.workspace.name}
                              </p>
                              <p className="mt-1.5 text-base font-semibold tracking-tight text-foreground">
                                {item.post.title}
                              </p>
                              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                {snippet(item.content)}
                              </p>
                            </div>
                          </Link>
                        </li>
                      )
                    )}
                  </ul>
                )}

                {followingCursor ? (
                  <div className="mt-6 flex justify-center">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        if (!followingCursor) return;
                        const fd = await loadFollowing(followingCursor);
                        setFollowing((prev) => [...prev, ...fd.items]);
                        setFollowingCursor(fd.nextCursor);
                      }}
                    >
                      Load more
                    </Button>
                  </div>
                ) : null}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
