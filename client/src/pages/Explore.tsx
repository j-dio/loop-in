import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Compass, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import type { FollowingFeedItem } from "@/lib/api";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { EmptyState } from "@/components/feed/EmptyState";
import { SkeletonAppCard, SkeletonFeedRow, sectionLabel } from "@/components/feed/FeedSkeletons";
import { AppCard } from "@/components/feed/AppCard";
import { PulseCard } from "@/components/feed/PulseCard";
import type { PulseItem } from "@/hooks/useHomeFeed";
import { PostRow } from "@/components/feed/PostRow";

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

type FollowState = { following: boolean; followerCount: number };

export function Explore() {
  const { user } = useWorkspace();
  const [workspaces, setWorkspaces] = useState<ExploreWorkspace[]>([]);
  const [newApps, setNewApps] = useState<ExploreWorkspace[]>([]);
  const [pulse, setPulse] = useState<PulseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"discover" | "following">("discover");
  const [following, setFollowing] = useState<FollowingFeedItem[]>([]);
  const [followingCursor, setFollowingCursor] = useState<string | null>(null);
  const [followingLoaded, setFollowingLoaded] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [followingLoadingMore, setFollowingLoadingMore] = useState(false);

  const loadFollowing = useCallback(async (cursor?: string) => {
    const q = new URLSearchParams({ tab: "following" });
    if (cursor) q.set("cursor", cursor);
    return apiFetch<{ items: FollowingFeedItem[]; nextCursor: string | null }>(
      `/api/explore/feed?${q.toString()}`
    );
  }, []);

  // Keep a workspace's follow state in sync wherever it appears (new-apps strip + directory).
  const syncFollow = useCallback((slug: string, s: FollowState) => {
    const apply = (prev: ExploreWorkspace[]) =>
      prev.map((w) =>
        w.slug === slug ? { ...w, isFollowing: s.following, followerCount: s.followerCount } : w
      );
    setWorkspaces(apply);
    setNewApps(apply);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const [ws, recent, pulseRes] = await Promise.all([
          apiFetch<{ workspaces: ExploreWorkspace[] }>("/api/explore/workspaces"),
          apiFetch<{ workspaces: ExploreWorkspace[] }>(
            "/api/explore/workspaces?sort=newest&limit=12"
          ),
          apiFetch<{ items: PulseItem[]; nextCursor: string | null }>(
            "/api/explore/feed?tab=pulse"
          ),
        ]);
        if (cancelled) return;
        setWorkspaces(ws.workspaces);
        setNewApps(recent.workspaces);
        setPulse(pulseRes.items);
      } catch {
        if (!cancelled) setError("Could not load public boards. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fix: reset Following state when the signed-in user changes so user B
  // never sees user A's cached feed after an account switch.
  useEffect(() => {
    setFollowing([]);
    setFollowingCursor(null);
    setFollowingLoaded(false);
  }, [user?.id]);

  useEffect(() => {
    if (tab !== "following" || !user || followingLoaded) return;
    let cancelled = false;
    setFollowingLoading(true);
    void (async () => {
      try {
        const fd = await loadFollowing();
        if (cancelled) return;
        setFollowing(fd.items);
        setFollowingCursor(fd.nextCursor);
      } catch {
        /* leave empty; empty state handles it */
      } finally {
        if (!cancelled) {
          setFollowingLoaded(true);
          setFollowingLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, user, followingLoaded, loadFollowing]);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
      <main>
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
          <div className="mt-12 space-y-14">
            <section>
              <Skeleton className="h-3 w-28" />
              <div className="mt-4 flex gap-3 overflow-hidden">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonAppCard key={i} compact />
                ))}
              </div>
            </section>
            <section>
              <Skeleton className="h-3 w-32" />
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonAppCard key={i} />
                ))}
              </div>
            </section>
            <section>
              <Skeleton className="h-3 w-36" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonFeedRow key={i} />
                ))}
              </div>
            </section>
          </div>
        ) : (
          <>
            {tab === "discover" ? (
              <>
                {/* New apps strip */}
                {newApps.length > 0 ? (
                  <section className="mt-12" aria-labelledby="new-heading">
                    <h2 id="new-heading" className={`flex items-center gap-2 ${sectionLabel}`}>
                      <Sparkles className="size-3.5 text-brand" /> Just launched
                    </h2>
                    <div className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pt-2 [scrollbar-width:thin]">
                      {newApps.map((w) => (
                        <AppCard
                          key={w.id}
                          workspace={w}
                          compact
                          onFollowChange={syncFollow}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

                {/* Public workspaces directory */}
                <section className="mt-12" aria-labelledby="ws-heading">
                  <h2 id="ws-heading" className={sectionLabel}>
                    Public boards · {workspaces.length}
                  </h2>
                  {workspaces.length === 0 ? (
                    <EmptyState icon={Compass} title="No public boards yet">
                      Public feedback boards will show up here as teams open them to the world.
                    </EmptyState>
                  ) : (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {workspaces.map((w) => (
                        <AppCard
                          key={w.id}
                          workspace={w}
                          onFollowChange={syncFollow}
                        />
                      ))}
                    </div>
                  )}
                </section>

                {/* What's happening — pulse (status updates across all public boards) */}
                {pulse.length > 0 ? (
                  <section className="mt-14" aria-labelledby="pulse-heading">
                    <h2 id="pulse-heading" className={`flex items-center gap-2 ${sectionLabel}`}>
                      <Zap className="size-3.5 text-brand" /> What&apos;s happening
                    </h2>
                    <ul className="mt-4 space-y-3">
                      {pulse.map((item) => (
                        <li key={item.id}>
                          <PulseCard item={item} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </>
            ) : (
              <section className="mt-12" aria-labelledby="following-heading">
                <h2 id="following-heading" className={sectionLabel}>
                  From apps you follow
                </h2>
                {followingLoading ? (
                  <div className="mt-4 space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <SkeletonFeedRow key={i} />
                    ))}
                  </div>
                ) : following.length === 0 ? (
                  <EmptyState
                    icon={Compass}
                    title="You're not following any apps yet"
                    action={
                      <Button variant="brand" size="sm" onClick={() => setTab("discover")}>
                        Browse Discover
                      </Button>
                    }
                  >
                    Follow apps from Discover and their new posts and updates show up here.
                  </EmptyState>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {following.map((item) =>
                      item.type === "post" ? (
                        <li key={`p-${item.id}`}>
                          <PostRow item={item} />
                        </li>
                      ) : (
                        <li key={`u-${item.id}`}>
                          <PulseCard item={item} />
                        </li>
                      )
                    )}
                  </ul>
                )}

                {followingCursor ? (
                  <div className="mt-6 flex justify-center">
                    <Button
                      variant="outline"
                      disabled={followingLoadingMore}
                      onClick={async () => {
                        if (!followingCursor || followingLoadingMore) return;
                        setFollowingLoadingMore(true);
                        try {
                          const fd = await loadFollowing(followingCursor);
                          setFollowing((prev) => [...prev, ...fd.items]);
                          setFollowingCursor(fd.nextCursor);
                        } catch {
                          /* keep what we have */
                        } finally {
                          setFollowingLoadingMore(false);
                        }
                      }}
                    >
                      {followingLoadingMore ? "Loading…" : "Load more"}
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
