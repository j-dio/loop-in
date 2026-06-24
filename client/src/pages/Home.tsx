import { Link } from "react-router-dom";
import { Compass, Sparkles, Zap } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feed/EmptyState";
import { SkeletonAppCard, SkeletonFeedRow, sectionLabel } from "@/components/feed/FeedSkeletons";
import { AppCard } from "@/components/feed/AppCard";
import { PulseCard } from "@/components/feed/PulseCard";
import { PostRow } from "@/components/feed/PostRow";
import { useHomeFeed } from "@/hooks/useHomeFeed";

export function Home() {
  const {
    mode,
    loading,
    apps,
    newApps,
    pulse,
    following,
    followingCursor,
    loadingMoreFollowing,
    loadMoreFollowing,
    syncFollow,
    error,
  } = useHomeFeed();

  return (
    <div className="space-y-10 px-5 py-8 sm:px-8">
      <PageHeader eyebrow="YOUR FEED" title="Home" />

      {loading ? (
        <div className="space-y-14">
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
      ) : error ? (
        <p
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : mode === "discovery" ? (
        <div className="space-y-14">
          {/* Framing line */}
          <p className="text-sm text-muted-foreground">
            Follow apps to build your personal feed — new posts and updates will appear here.
          </p>

          {/* Just launched strip */}
          {newApps.length > 0 ? (
            <section aria-labelledby="home-new-heading">
              <h2 id="home-new-heading" className={`flex items-center gap-2 ${sectionLabel}`}>
                <Sparkles className="size-3.5 text-brand" /> Just launched
              </h2>
              <div className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pt-2 [scrollbar-width:thin]">
                {newApps.map((w) => (
                  <AppCard key={w.id} workspace={w} compact onFollowChange={syncFollow} />
                ))}
              </div>
            </section>
          ) : null}

          {/* Trending apps grid */}
          <section aria-labelledby="home-apps-heading">
            <h2 id="home-apps-heading" className={sectionLabel}>
              Trending apps
            </h2>
            {apps.length === 0 ? (
              <EmptyState icon={Compass} title="No public boards yet">
                Public feedback boards will show up here as teams open them to the world.
              </EmptyState>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {apps.map((w) => (
                  <AppCard key={w.id} workspace={w} onFollowChange={syncFollow} />
                ))}
              </div>
            )}
          </section>

          {/* What's happening pulse list */}
          {pulse.length > 0 ? (
            <section aria-labelledby="home-pulse-heading">
              <h2 id="home-pulse-heading" className={`flex items-center gap-2 ${sectionLabel}`}>
                <Zap className="size-3.5 text-brand" /> What&apos;s happening
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
        </div>
      ) : (
        /* mode === "following" */
        <div className="space-y-8">
          {/* Slim discover link */}
          <p className="text-sm text-muted-foreground">
            Showing posts from apps you follow.{" "}
            <Link
              to="/explore"
              className="font-medium text-brand hover:underline"
            >
              Discover more →
            </Link>
          </p>

          {/* Following feed */}
          <section aria-labelledby="home-following-heading">
            <h2 id="home-following-heading" className={sectionLabel}>
              From apps you follow
            </h2>
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

              {followingCursor ? (
                <div className="mt-6 flex justify-center">
                  <Button variant="outline" onClick={loadMoreFollowing} disabled={loadingMoreFollowing || !followingCursor}>
                    Load more
                  </Button>
                </div>
              ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
