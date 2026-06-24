import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Compass, Radio, Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { apiFetch } from "@/lib/api";
import type { FollowingFeedItem } from "@/lib/api";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { EmptyState } from "@/components/feed/EmptyState";
import {
  SkeletonAppCard,
  SkeletonAppRow,
  SkeletonFeedRow,
  sectionLabel,
} from "@/components/feed/FeedSkeletons";
import { AppCard } from "@/components/feed/AppCard";
import { AppRow } from "@/components/feed/AppRow";
import { FeaturedApp } from "@/components/feed/FeaturedApp";
import { PulseCard } from "@/components/feed/PulseCard";
import type { PulseItem } from "@/hooks/useHomeFeed";
import { PostRow } from "@/components/feed/PostRow";

type ExploreWorkspace = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  logoUrl: string | null;
  createdAt: string;
  postCount: number;
  followerCount: number;
  isFollowing: boolean;
};

type WorkspacesResponse = { workspaces: ExploreWorkspace[]; hasMore: boolean };
type FollowState = { following: boolean; followerCount: number };

const DIRECTORY_PAGE = 10;
const SEARCH_PAGE = 20;

export function Explore() {
  const { user } = useWorkspace();

  // Front-door (discover, no search). The directory is page-based (10/page), numbered
  // locally 01–10 each page; the featured app (#1 by followers) sits above it and is
  // excluded from the list, so directory pages cover ranks 2+ (offset 1).
  const [featured, setFeatured] = useState<ExploreWorkspace | null>(null);
  const [directory, setDirectory] = useState<ExploreWorkspace[]>([]);
  const [directoryPage, setDirectoryPage] = useState(0);
  const [directoryHasMore, setDirectoryHasMore] = useState(false);
  const [directoryBusy, setDirectoryBusy] = useState(false);
  const [newApps, setNewApps] = useState<ExploreWorkspace[]>([]);
  const [pulse, setPulse] = useState<PulseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // App search
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [results, setResults] = useState<ExploreWorkspace[]>([]);
  const [resultsHasMore, setResultsHasMore] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMoreBusy, setSearchMoreBusy] = useState(false);

  // Tabs / Following
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

  // Keep a workspace's follow state in sync wherever it appears.
  const syncFollow = useCallback((slug: string, s: FollowState) => {
    const apply = (prev: ExploreWorkspace[]) =>
      prev.map((w) =>
        w.slug === slug ? { ...w, isFollowing: s.following, followerCount: s.followerCount } : w
      );
    setDirectory(apply);
    setNewApps(apply);
    setResults(apply);
    setFeatured((prev) =>
      prev && prev.slug === slug
        ? { ...prev, isFollowing: s.following, followerCount: s.followerCount }
        : prev
    );
  }, []);

  // Initial front-door load.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const [top, page0, recent, pulseRes] = await Promise.all([
          apiFetch<WorkspacesResponse>("/api/explore/workspaces?sort=followers&limit=1"),
          apiFetch<WorkspacesResponse>(
            `/api/explore/workspaces?sort=followers&limit=${DIRECTORY_PAGE}&offset=1`
          ),
          apiFetch<WorkspacesResponse>("/api/explore/workspaces?sort=newest&limit=8"),
          apiFetch<{ items: PulseItem[]; nextCursor: string | null }>("/api/explore/feed?tab=pulse"),
        ]);
        if (cancelled) return;
        setFeatured(top.workspaces[0] ?? null);
        setDirectory(page0.workspaces);
        setDirectoryPage(0);
        setDirectoryHasMore(page0.hasMore);
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

  // Debounce the search box.
  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(value.trim()), 300);
  }
  function clearSearch() {
    setSearchInput("");
    setSearchQuery("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }

  // Run the app search whenever the debounced query changes.
  useEffect(() => {
    if (!searchQuery) {
      setResults([]);
      setResultsHasMore(false);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    void (async () => {
      try {
        const res = await apiFetch<WorkspacesResponse>(
          `/api/explore/workspaces?sort=followers&limit=${SEARCH_PAGE}&q=${encodeURIComponent(searchQuery)}`
        );
        if (cancelled) return;
        setResults(res.workspaces);
        setResultsHasMore(res.hasMore);
      } catch {
        if (!cancelled) {
          setResults([]);
          setResultsHasMore(false);
        }
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchQuery]);

  // Reset Following state on account switch so user B never sees user A's cache.
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

  async function goToDirectoryPage(page: number) {
    if (directoryBusy || page < 0) return;
    setDirectoryBusy(true);
    try {
      // +1 skips the featured app (rank #1), which is shown above the list.
      const offset = 1 + page * DIRECTORY_PAGE;
      const res = await apiFetch<WorkspacesResponse>(
        `/api/explore/workspaces?sort=followers&limit=${DIRECTORY_PAGE}&offset=${offset}`
      );
      setDirectory(res.workspaces);
      setDirectoryHasMore(res.hasMore);
      setDirectoryPage(page);
    } catch {
      /* keep current page */
    } finally {
      setDirectoryBusy(false);
    }
  }

  async function loadMoreResults() {
    if (searchMoreBusy || !resultsHasMore || !searchQuery) return;
    setSearchMoreBusy(true);
    try {
      const res = await apiFetch<WorkspacesResponse>(
        `/api/explore/workspaces?sort=followers&limit=${SEARCH_PAGE}&offset=${results.length}&q=${encodeURIComponent(searchQuery)}`
      );
      setResults((prev) => [...prev, ...res.workspaces]);
      setResultsHasMore(res.hasMore);
    } catch {
      /* keep what we have */
    } finally {
      setSearchMoreBusy(false);
    }
  }

  const searching = searchQuery.length > 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
      <motion.div initial="hidden" animate="show" variants={staggerContainer(0.08)}>
        <motion.p
          variants={fadeUp}
          className="flex items-center gap-2 font-mono text-xs tracking-[0.22em] text-brand uppercase"
        >
          <Compass className="size-3.5" /> Public discovery
        </motion.p>
        <motion.h1
          variants={fadeUp}
          className="font-display mt-4 max-w-3xl text-[clamp(2.25rem,5vw,3.75rem)] leading-[0.98] font-semibold tracking-[-0.03em]"
        >
          See what people are asking for.
        </motion.h1>
        <motion.p variants={fadeUp} className="mt-4 max-w-xl text-muted-foreground">
          Open feedback boards from teams building in public. Find something you care about — sign
          in to upvote it or add your own idea.
        </motion.p>
      </motion.div>

      {/* Search + tabs */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search apps…"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-10 pl-9 pr-8"
            aria-label="Search public apps"
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
        {user && !searching ? (
          <Segmented
            value={tab}
            onChange={(v) => setTab(v as "discover" | "following")}
            options={[["discover", "Discover"], ["following", "Following"]]}
          />
        ) : null}
      </div>

      {error ? (
        <p
          className="mt-8 border-l-2 border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {/* === SEARCH RESULTS === */}
      {searching ? (
        <section className="mt-10" aria-labelledby="results-heading">
          <h2 id="results-heading" className={sectionLabel}>
            Results · {results.length}
            {resultsHasMore ? "+" : ""}
          </h2>
          {searchLoading ? (
            <div className="mt-2 divide-y divide-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonAppRow key={i} />
              ))}
            </div>
          ) : results.length === 0 ? (
            <EmptyState icon={Search} title={`No apps match “${searchQuery}”`}>
              Try a different name, or clear the search to browse everything.
            </EmptyState>
          ) : (
            <>
              <div className="mt-2 divide-y divide-border">
                {results.map((w, i) => (
                  <AppRow key={w.id} workspace={w} index={i + 1} onFollowChange={syncFollow} />
                ))}
              </div>
              {resultsHasMore ? (
                <div className="mt-6 flex justify-center">
                  <Button variant="outline" disabled={searchMoreBusy} onClick={loadMoreResults}>
                    {searchMoreBusy ? "Loading…" : "Load more"}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : loading ? (
        /* === INITIAL SKELETON === */
        <div className="mt-10 space-y-12">
          <div className="border-y border-border py-8">
            <SkeletonAppRow />
          </div>
          <section>
            <SkeletonLabel />
            <div className="mt-4 flex gap-3 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonAppCard key={i} compact />
              ))}
            </div>
          </section>
          <section>
            <SkeletonLabel />
            <div className="mt-2 divide-y divide-border">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonAppRow key={i} />
              ))}
            </div>
          </section>
        </div>
      ) : tab === "discover" ? (
        /* === DISCOVER FRONT-DOOR === */
        <>
          {featured ? (
            <section className="mt-10" aria-label="Featured app">
              <p className={`flex items-center gap-2 ${sectionLabel}`}>
                <Sparkles className="size-3.5 text-brand" /> Featured
              </p>
              <FeaturedApp workspace={featured} onFollowChange={syncFollow} />
            </section>
          ) : null}

          {newApps.length > 0 ? (
            <section className="mt-12" aria-labelledby="new-heading">
              <h2 id="new-heading" className={`flex items-center gap-2 ${sectionLabel}`}>
                <Sparkles className="size-3.5 text-brand" /> Just launched
              </h2>
              <div className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
                {newApps.map((w) => (
                  <AppCard key={w.id} workspace={w} compact onFollowChange={syncFollow} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-12" aria-labelledby="ws-heading">
            <h2 id="ws-heading" className={sectionLabel}>
              {featured ? "More apps · by followers" : "All apps"}
            </h2>
            {directory.length === 0 && !featured ? (
              <EmptyState icon={Compass} title="No public boards yet">
                Public feedback boards show up here as teams open them to the world.
              </EmptyState>
            ) : directory.length === 0 ? null : (
              <>
                <div
                  className={
                    "mt-2 divide-y divide-border transition-opacity " +
                    (directoryBusy ? "opacity-50" : "opacity-100")
                  }
                >
                  {directory.map((w, i) => (
                    <AppRow
                      key={w.id}
                      workspace={w}
                      index={directoryPage * DIRECTORY_PAGE + i + 1}
                      onFollowChange={syncFollow}
                    />
                  ))}
                </div>
                {directoryPage > 0 || directoryHasMore ? (
                  <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={directoryBusy || directoryPage === 0}
                      onClick={() => goToDirectoryPage(directoryPage - 1)}
                    >
                      <ChevronLeft className="size-4" /> Previous
                    </Button>
                    <span className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase tabular-nums">
                      Page {directoryPage + 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={directoryBusy || !directoryHasMore}
                      onClick={() => goToDirectoryPage(directoryPage + 1)}
                    >
                      Next <ChevronRight className="size-4" />
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </section>

          {pulse.length > 0 ? (
            <section className="mt-14" aria-labelledby="pulse-heading">
              <h2 id="pulse-heading" className={`flex items-center gap-2 ${sectionLabel}`}>
                <Radio className="size-3.5 text-brand" /> What&apos;s happening
              </h2>
              <ul className="mt-2 divide-y divide-border">
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
        /* === FOLLOWING TAB === */
        <section className="mt-10" aria-labelledby="following-heading">
          <h2 id="following-heading" className={sectionLabel}>
            From apps you follow
          </h2>
          {followingLoading ? (
            <div className="mt-2 divide-y divide-border">
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
            <ul className="mt-2 divide-y divide-border">
              {following.map((item) =>
                item.type === "post" ? (
                  <li key={`p-${item.id}`}>
                    <PostRow item={item} />
                  </li>
                ) : item.type === "update" || item.type === "announcement" ? (
                  <li key={`${item.type[0]}-${item.id}`}>
                    <PulseCard item={item} />
                  </li>
                ) : null
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
    </div>
  );
}

function SkeletonLabel() {
  return <div className="h-3 w-28 animate-pulse rounded bg-muted" />;
}
