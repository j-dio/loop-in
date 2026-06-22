import { Link } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import { WorkspaceTile } from "@/components/WorkspaceTile";
import { FollowButton } from "@/components/FollowButton";

export interface AppCardWorkspace {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  postCount?: number;
  followerCount: number;
  isFollowing: boolean;
}

interface AppCardProps {
  workspace: AppCardWorkspace;
  compact?: boolean;
  onFollowChange: (slug: string, data: { following: boolean; followerCount: number }) => void;
}

/**
 * Unified app discovery card.
 * `compact` — narrow strip variant (w-60, snap-start, follower count only).
 * Default — full grid card (post count + follower count).
 */
export function AppCard({ workspace: w, compact = false, onFollowChange }: AppCardProps) {
  if (compact) {
    return (
      <div className="group flex w-60 shrink-0 snap-start flex-col gap-4 rounded-xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-brand/40">
        <Link
          to={`/${encodeURIComponent(w.slug)}`}
          className="flex items-center gap-3"
        >
          <WorkspaceTile
            name={w.name}
            seed={w.slug}
            logoUrl={w.logoUrl}
            sizeClassName="size-10"
          />
          <div className="min-w-0">
            <h3 className="font-display truncate text-base font-semibold tracking-tight group-hover:text-brand">
              {w.name}
            </h3>
            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
              /{w.slug}
            </p>
          </div>
        </Link>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="tabular-nums">
            {w.followerCount} {w.followerCount === 1 ? "follower" : "followers"}
          </span>
          <FollowButton
            slug={w.slug}
            initialFollowing={w.isFollowing}
            initialCount={w.followerCount}
            onChange={(s) => onFollowChange(w.slug, s)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="group flex flex-col justify-between gap-4 rounded-xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-brand/40">
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
            {w.postCount ?? 0} {(w.postCount ?? 0) === 1 ? "post" : "posts"}
          </span>
          <span className="tabular-nums">
            {w.followerCount} {w.followerCount === 1 ? "follower" : "followers"}
          </span>
        </span>
        <FollowButton
          slug={w.slug}
          initialFollowing={w.isFollowing}
          initialCount={w.followerCount}
          onChange={(s) => onFollowChange(w.slug, s)}
        />
      </div>
    </div>
  );
}
