import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { FollowingFeedItem } from "@/lib/api";
import { useWorkspace } from "@/context/WorkspaceContext";
import { homeMode } from "@/components/feed/feedRules";
import type { HomeMode } from "@/components/feed/feedRules";

// ExploreWorkspace shape mirrors the list endpoint response.
export type ExploreWorkspace = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  createdAt: string;
  postCount: number;
  followerCount: number;
  isFollowing: boolean;
};

// Pulse items are status-update entries from the following feed.
export type PulseItem = Extract<FollowingFeedItem, { type: "update" }>;

type FollowState = { following: boolean; followerCount: number };

export type UseHomeFeedResult = {
  mode: HomeMode;
  loading: boolean;
  apps: ExploreWorkspace[];
  newApps: ExploreWorkspace[];
  pulse: PulseItem[];
  following: FollowingFeedItem[];
  followingCursor: string | null;
  loadMoreFollowing: () => Promise<void>;
  syncFollow: (slug: string, data: FollowState) => void;
  error: string | null;
};

export function useHomeFeed(): UseHomeFeedResult {
  const { user } = useWorkspace();

  const [apps, setApps] = useState<ExploreWorkspace[]>([]);
  const [newApps, setNewApps] = useState<ExploreWorkspace[]>([]);
  const [pulse, setPulse] = useState<PulseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [following, setFollowing] = useState<FollowingFeedItem[]>([]);
  const [followingCursor, setFollowingCursor] = useState<string | null>(null);
  const [followingResolved, setFollowingResolved] = useState(false);
  const [loadingMoreFollowing, setLoadingMoreFollowing] = useState(false);

  // Derive mode: stays "discovery" until the following request resolves.
  const mode: HomeMode = followingResolved ? homeMode(following.length) : "discovery";

  // Reset following state when the signed-in user changes so user B never sees
  // user A's cached feed after an account switch. (Mirrors Explore.tsx lines 128–132.)
  useEffect(() => {
    setFollowing([]);
    setFollowingCursor(null);
    setFollowingResolved(false);
  }, [user?.id]);

  // Mount effect: parallel-fetch all feeds; also fetch following if signed in.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const baseRequests: [
          Promise<{ workspaces: ExploreWorkspace[] }>,
          Promise<{ workspaces: ExploreWorkspace[] }>,
          Promise<{ items: FollowingFeedItem[]; nextCursor: string | null }>,
        ] = [
          apiFetch<{ workspaces: ExploreWorkspace[] }>("/api/explore/workspaces"),
          apiFetch<{ workspaces: ExploreWorkspace[] }>(
            "/api/explore/workspaces?sort=newest&limit=12"
          ),
          apiFetch<{ items: FollowingFeedItem[]; nextCursor: string | null }>(
            "/api/explore/feed?tab=pulse"
          ),
        ];

        if (user) {
          // Fetch all four in parallel when signed in.
          const [ws, recent, pulseRes, followingRes] = await Promise.all([
            ...baseRequests,
            apiFetch<{ items: FollowingFeedItem[]; nextCursor: string | null }>(
              "/api/explore/feed?tab=following"
            ),
          ] as const);

          if (cancelled) return;

          setApps(ws.workspaces);
          setNewApps(recent.workspaces);
          // Pulse = only "update" type items.
          setPulse(
            pulseRes.items.filter((item): item is PulseItem => item.type === "update")
          );
          setFollowing(followingRes.items);
          setFollowingCursor(followingRes.nextCursor);
          setFollowingResolved(true);
        } else {
          // Guest: fetch three base requests in parallel.
          const [ws, recent, pulseRes] = await Promise.all(baseRequests);

          if (cancelled) return;

          setApps(ws.workspaces);
          setNewApps(recent.workspaces);
          setPulse(
            pulseRes.items.filter((item): item is PulseItem => item.type === "update")
          );
        }
      } catch {
        if (!cancelled) setError("Could not load feed. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Loads the next page of the following feed using the current cursor.
  const loadMoreFollowing = useCallback(async () => {
    if (!followingCursor || loadingMoreFollowing) return;
    setLoadingMoreFollowing(true);
    try {
      const q = new URLSearchParams({ tab: "following", cursor: followingCursor });
      const res = await apiFetch<{ items: FollowingFeedItem[]; nextCursor: string | null }>(
        `/api/explore/feed?${q.toString()}`
      );
      setFollowing((prev) => [...prev, ...res.items]);
      setFollowingCursor(res.nextCursor);
    } catch {
      /* keep existing items */
    } finally {
      setLoadingMoreFollowing(false);
    }
  }, [followingCursor, loadingMoreFollowing]);

  // Updates follower counts and follow state for a workspace by slug in both lists.
  const syncFollow = useCallback((slug: string, data: FollowState) => {
    const apply = (prev: ExploreWorkspace[]) =>
      prev.map((w) =>
        w.slug === slug
          ? { ...w, isFollowing: data.following, followerCount: data.followerCount }
          : w
      );
    setApps(apply);
    setNewApps(apply);
  }, []);

  return {
    mode,
    loading,
    apps,
    newApps,
    pulse,
    following,
    followingCursor,
    loadMoreFollowing,
    syncFollow,
    error,
  };
}
