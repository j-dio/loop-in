import { Link } from "react-router-dom";
import { MessageSquare, Users } from "lucide-react";
import { WorkspaceTile } from "@/components/WorkspaceTile";
import { FollowButton } from "@/components/FollowButton";
import type { AppCardWorkspace } from "./AppCard";

interface AppRowProps {
  workspace: AppCardWorkspace;
  /** 1-based rank, rendered as a ghost index numeral in the left margin. */
  index: number;
  onFollowChange: (slug: string, data: { following: boolean; followerCount: number }) => void;
}

/**
 * Editorial directory row (Signal Stark): a ranked, hairline-separated list line —
 * index numeral, identity, tagline, stats, follow. Scales to hundreds without the
 * visual noise of a repeated card grid. Parent supplies `divide-y divide-border`.
 */
export function AppRow({ workspace: w, index, onFollowChange }: AppRowProps) {
  return (
    <div className="group relative flex items-center gap-4 py-4 transition-colors sm:gap-6">
      <span
        className="hidden w-8 shrink-0 text-right font-mono text-sm text-muted-foreground/45 tabular-nums sm:block"
        aria-hidden
      >
        {String(index).padStart(2, "0")}
      </span>

      <Link
        to={`/${encodeURIComponent(w.slug)}`}
        className="flex min-w-0 flex-1 items-center gap-4"
      >
        <WorkspaceTile name={w.name} seed={w.slug} logoUrl={w.logoUrl} sizeClassName="size-11" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="font-display truncate text-base font-semibold tracking-tight transition-colors group-hover:text-brand">
              {w.name}
            </h3>
            <span className="hidden shrink-0 font-mono text-[11px] text-muted-foreground/70 sm:inline">
              /{w.slug}
            </span>
          </div>
          {w.tagline ? (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{w.tagline}</p>
          ) : (
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground/70 sm:hidden">
              /{w.slug}
            </p>
          )}
        </div>
      </Link>

      <span className="hidden items-center gap-4 font-mono text-[11px] text-muted-foreground tabular-nums md:flex">
        <span className="inline-flex items-center gap-1.5">
          <MessageSquare className="size-3" aria-hidden />
          {w.postCount ?? 0}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users className="size-3" aria-hidden />
          {w.followerCount}
        </span>
      </span>

      <div className="shrink-0">
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
