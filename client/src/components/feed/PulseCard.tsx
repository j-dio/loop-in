import { Link } from "react-router-dom";
import { Megaphone } from "lucide-react";
import { WorkspaceTile } from "@/components/WorkspaceTile";
import { snippet } from "./text";
import type { ExploreUpdateItem, ExploreAnnouncementItem } from "@/lib/api";

export type PulseCardItem = ExploreUpdateItem | ExploreAnnouncementItem;

interface PulseCardProps {
  item: PulseCardItem;
}

/**
 * Feed card rendered in the Following / Pulse feeds.
 * Handles two item shapes:
 *   - "update"       → amber "Update" tag, parent post title, body snippet
 *   - "announcement" → amber "Announcement" tag, post title, description snippet
 */
export function PulseCard({ item }: PulseCardProps) {
  const { workspace } = item;

  if (item.type === "announcement") {
    return (
      <Link
        to={`/${encodeURIComponent(workspace.slug)}/post/${item.id}`}
        className="group flex gap-4 rounded-xl border border-brand/30 bg-brand-bright/5 p-4 transition-all hover:-translate-y-0.5 hover:border-brand/50 sm:p-5"
      >
        <WorkspaceTile
          name={workspace.name}
          seed={workspace.slug}
          logoUrl={workspace.logoUrl}
          sizeClassName="size-11"
        />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] tracking-[0.18em] text-amber-600 uppercase dark:text-amber-400">
            Announcement · {workspace.name}
          </p>
          <p className="mt-1.5 text-base font-semibold tracking-tight text-foreground">
            {item.title}
          </p>
          {snippet(item.description) ? (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {snippet(item.description)}
            </p>
          ) : null}
          {item.upvoteCount > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground tabular-nums">
              {item.upvoteCount} {item.upvoteCount === 1 ? "upvote" : "upvotes"}
            </p>
          ) : null}
        </div>
      </Link>
    );
  }

  const { post, content } = item;
  return (
    <Link
      to={`/${encodeURIComponent(workspace.slug)}/post/${post.id}`}
      className="group flex gap-4 rounded-xl border border-brand/30 bg-brand-bright/5 p-4 transition-all hover:-translate-y-0.5 hover:border-brand/50 sm:p-5"
    >
      <WorkspaceTile
        name={workspace.name}
        seed={workspace.slug}
        logoUrl={workspace.logoUrl}
        sizeClassName="size-11"
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.18em] text-brand uppercase">
          <Megaphone className="size-3.5" /> Update · {workspace.name}
        </p>
        <p className="mt-1.5 text-base font-semibold tracking-tight text-foreground">
          {post.title}
        </p>
        {snippet(content) ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {snippet(content)}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
