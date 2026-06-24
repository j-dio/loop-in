import { Link } from "react-router-dom";
import { ArrowUpRight, MessageSquare } from "lucide-react";
import { WorkspaceTile } from "@/components/WorkspaceTile";
import { FollowButton } from "@/components/FollowButton";
import type { AppCardWorkspace } from "./AppCard";

interface FeaturedAppProps {
  workspace: AppCardWorkspace;
  onFollowChange: (slug: string, data: { following: boolean; followerCount: number }) => void;
}

/**
 * Editorial spotlight for the single most-followed public app. Asymmetric, rule-framed
 * (no boxed card), with an oversized ghost follower numeral anchoring the right column.
 */
export function FeaturedApp({ workspace: w, onFollowChange }: FeaturedAppProps) {
  return (
    <div className="grid items-center gap-8 border-y border-border py-8 md:grid-cols-[1.6fr_1fr] md:gap-12 md:py-10">
      <div className="flex min-w-0 items-start gap-5">
        <WorkspaceTile
          name={w.name}
          seed={w.slug}
          logoUrl={w.logoUrl}
          sizeClassName="size-16 sm:size-20"
          monogramClassName="text-2xl sm:text-3xl"
        />
        <div className="min-w-0">
          <Link to={`/${encodeURIComponent(w.slug)}`} className="group inline-flex items-start gap-1">
            <h2 className="font-display text-[clamp(1.6rem,3.4vw,2.5rem)] font-semibold leading-[1.02] tracking-tight transition-colors group-hover:text-brand">
              {w.name}
            </h2>
            <ArrowUpRight className="mt-1 size-5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-brand" aria-hidden />
          </Link>
          <p className="mt-1 font-mono text-xs tracking-wide text-muted-foreground">/{w.slug}</p>
          {w.tagline ? (
            <p className="mt-3 max-w-md text-pretty text-[15px] leading-relaxed text-muted-foreground">
              {w.tagline}
            </p>
          ) : null}
          <div className="mt-5 flex items-center gap-4">
            <FollowButton
              slug={w.slug}
              initialFollowing={w.isFollowing}
              initialCount={w.followerCount}
              onChange={(s) => onFollowChange(w.slug, s)}
            />
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground tabular-nums">
              <MessageSquare className="size-3" aria-hidden />
              {w.postCount ?? 0} {(w.postCount ?? 0) === 1 ? "post" : "posts"}
            </span>
          </div>
        </div>
      </div>

      <div className="hidden flex-col items-end border-l border-border pl-8 md:flex">
        <span className="font-display text-[clamp(3rem,7vw,5rem)] font-bold leading-none tracking-tight tabular-nums">
          {w.followerCount}
        </span>
        <span className="mt-1 font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
          {w.followerCount === 1 ? "Follower" : "Followers"}
        </span>
      </div>
    </div>
  );
}
