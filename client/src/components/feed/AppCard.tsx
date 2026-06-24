import { Link } from "react-router-dom";
import { MessageSquare, Users } from "lucide-react";
import { WorkspaceTile } from "@/components/WorkspaceTile";
import { FollowButton } from "@/components/FollowButton";

export interface AppCardWorkspace {
  id: string;
  name: string;
  slug: string;
  tagline?: string | null;
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
 * App discovery tile. Stark, de-boxed: a hairline frame that warms to amber on hover,
 * no drop-shadow lift. Used by the "just launched" rail (`compact`) and the Home/Welcome grids.
 * The editorial Explore directory uses `AppRow` instead.
 */
export function AppCard({ workspace: w, compact = false, onFollowChange }: AppCardProps) {
  return (
    <div
      className={
        "group relative flex flex-col gap-4 rounded-lg border border-border bg-card/40 p-5 transition-colors hover:border-brand/50 hover:bg-card" +
        (compact ? " w-64 shrink-0 snap-start" : "")
      }
    >
      <Link to={`/${encodeURIComponent(w.slug)}`} className="flex items-start gap-3">
        <WorkspaceTile name={w.name} seed={w.slug} logoUrl={w.logoUrl} sizeClassName="size-11" />
        <div className="min-w-0 flex-1">
          <h3 className="font-display truncate text-base font-semibold tracking-tight transition-colors group-hover:text-brand">
            {w.name}
          </h3>
          <p className="mt-0.5 truncate font-mono text-[11px] tracking-wide text-muted-foreground">
            /{w.slug}
          </p>
        </div>
      </Link>

      {w.tagline ? (
        <p className="line-clamp-2 -mt-1 text-sm leading-relaxed text-muted-foreground">
          {w.tagline}
        </p>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/70 pt-3">
        <span className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground tabular-nums">
          {!compact && w.postCount !== undefined ? (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="size-3" aria-hidden />
              {w.postCount}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Users className="size-3" aria-hidden />
            {w.followerCount}
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
